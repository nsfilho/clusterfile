#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = __importDefault(require("commander"));
const config_1 = require("./config");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const bufferSize = process.env.BUFFER_SIZE || '50000';
const cpCmd = (machine, sourceFile, destinationFile) => {
    return new Promise((resolve, reject) => {
        const prefixA = `${machine.shortName}: `;
        const prefixB = `\n${machine.shortName}> `;
        const sizeLine = process.stdout.columns - prefixA.length - 1;
        let dataOut = '';
        const filterData = (data) => data
            .split('\n')
            .map(v => {
            const totalLines = Math.ceil(v.length / sizeLine);
            let result = '';
            for (let x = 0; (x < totalLines && !commander_1.default.trunc) || x === 0; x++) {
                const subPart = v.substr(x * sizeLine, sizeLine);
                const prefixResult = x === 0 ? prefixA : prefixB;
                result += prefixResult + subPart;
            }
            return result;
        })
            .join('\n');
        const shell = machine.local
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
        const shellCmd = child_process_1.spawn(shell.shell, shell.args, {
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
const cpAll = (sourceFile, destinationFile) => {
    console.log(`Cluster Execution: ${sourceFile} -> ${destinationFile}`);
    const nodesToRun = config_1.clusterConfig.machine.filter(m => commander_1.default.tag === undefined || m.tags.includes(commander_1.default.tag));
    const allPromises = nodesToRun.map(m => cpCmd(m, sourceFile, destinationFile));
    Promise.all(allPromises).then(allLogs => allLogs.forEach(log => console.log(log)));
};
commander_1.default
    .helpOption('-h, --help', 'show options')
    .option('-t, --tag <tag>', 'only nodes with specific tag')
    .option('-l, --list', 'list all nodes in cluster', () => {
    console.log('Servidores encontrados:', config_1.clusterConfig.machine);
});
commander_1.default
    .command('cp <source> <destination>', 'Copy a local source file to nodes renaming for destination')
    .action((sourceFile, destinationFile) => {
    if (fs_1.existsSync(sourceFile))
        return cpAll(sourceFile, destinationFile);
    console.error(`Source file ${sourceFile} does not exists!`);
});
commander_1.default.parse(process.argv);
