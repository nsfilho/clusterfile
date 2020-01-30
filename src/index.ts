#!/usr/bin/env node

import program from 'commander';
import { clusterConfig, MachineConfig } from './config';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';

const bufferSize = process.env.BUFFER_SIZE || '50000';

interface ShellConfig {
    shell: string;
    args: string[];
}

const cpCmd = (
    machine: MachineConfig,
    sourceFile: string,
    destinationFile: string
) => {
    return new Promise((resolve, reject) => {
        const prefixA = `${machine.shortName}: `;
        const prefixB = `\n${machine.shortName}> `;
        const sizeLine = process.stdout.columns - prefixA.length - 1;
        let dataOut = '';

        const filterData = (data: string) =>
            data
                .split('\n')
                .map(v => {
                    const totalLines = Math.ceil(v.length / sizeLine);
                    let result = '';
                    for (
                        let x = 0;
                        (x < totalLines && !program.trunc) || x === 0;
                        x++
                    ) {
                        const subPart = v.substr(x * sizeLine, sizeLine);
                        const prefixResult = x === 0 ? prefixA : prefixB;
                        result += prefixResult + subPart;
                    }
                    return result;
                })
                .join('\n');

        const shell: ShellConfig = machine.local
            ? { shell: 'cp', args: [sourceFile, destinationFile] }
            : {
                  shell: 'scp',
                  args: [
                      '-B',
                      '-C',
                      '-p',
                      `-P ${machine.port}`,
                      sourceFile,
                      `${machine.user}@${machine.name}:${destinationFile}`
                  ]
              };
        const shellCmd = spawn(shell.shell, shell.args, {
            env: {
                COLUMNS: sizeLine.toString()
            }
        });
        shellCmd.stdout.on('data', data => {
            dataOut += data.toString();
        });
        shellCmd.stderr.on('data', data => {
            dataOut += data.toString();
        });
        shellCmd.on('close', code => {
            if (code !== 0)
                dataOut += `\n${machine.shortName}: exit with code ${code}`;
            resolve(filterData(dataOut));
        });
        shellCmd.stdin.end();
    });
};

const cpAll = (sourceFile: string, destinationFile: string) => {
    console.log(`Cluster Execution: ${sourceFile} -> ${destinationFile}`);
    const nodesToRun = clusterConfig.machine.filter(
        m => program.tag === undefined || m.tags.includes(program.tag)
    );
    const allPromises = nodesToRun.map(m =>
        cpCmd(m, sourceFile, destinationFile)
    );
    Promise.all(allPromises).then(allLogs =>
        allLogs.forEach(log => console.log(log))
    );
};

program
    .helpOption('-h, --help', 'show options')
    .option('-t, --tag <tag>', 'only nodes with specific tag')
    .option('-l, --list', 'list all nodes in cluster', () => {
        console.log('Servidores encontrados:', clusterConfig.machine);
    });

program
    .command(
        'cp <source> <destination>',
        'Copy a local source file to nodes renaming for destination'
    )
    .action((sourceFile, destinationFile) => {
        if (existsSync(sourceFile)) return cpAll(sourceFile, destinationFile);
        console.error(`Source file ${sourceFile} does not exists!`);
    });

program.parse(process.argv);
