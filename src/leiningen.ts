import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as utils from './utils';

let tempDirectory = process.env['RUNNER_TEMP'] || '';

if (!tempDirectory) {
    let baseLocation;
    if (process.platform === 'darwin') {
        baseLocation = '/Users';
    } else {
        baseLocation = '/home';
    }
    tempDirectory = path.join(baseLocation, 'actions', 'temp');
}

export async function setup(version: string): Promise<void> {
    let toolPath = tc.find(
        'ClojureLeiningen',
        utils.getCacheVersionString(version),
        os.arch()
    );

    if (toolPath) {
        core.debug(`Leiningen found in cache ${toolPath}`);
    } else {
        let leiningenFile = await tc.downloadTool(
            `https://raw.githubusercontent.com/technomancy/leiningen/${version}/bin/lein`
        );
        let tempDir: string = path.join(
            tempDirectory,
            'temp_' + Math.floor(Math.random() * 2000000000)
        );
        const leiningenDir = await installLeiningen(
            leiningenFile,
            tempDir
        );
        core.debug(`clojure tools deps installed to ${leiningenDir}`);
        toolPath = await tc.cacheDir(
            leiningenDir,
            'ClojureLeiningen',
            utils.getCacheVersionString(version)
        );
    }

    core.exportVariable('LEIN_HOME', toolPath);
    core.addPath(path.join(toolPath, 'bin'));
}

async function installLeiningen(
    binScript: string,
    destinationFolder: string
): Promise<string> {
    await io.mkdirP(destinationFolder);

    const bin = path.normalize(binScript);
    const binStats = fs.statSync(bin);
    if (binStats.isFile()) {
        const binDir = path.join(destinationFolder, 'leiningen', 'bin');
        const libDir = path.join(destinationFolder, 'leiningen', 'libexec');

        await io.mkdirP(binDir);
        await io.mkdirP(libDir);

        await io.mv(bin, path.join(binDir, `lein`));
        fs.chmodSync(path.join(binDir, `lein`), '0755');

        core.exportVariable('LEIN_HOME', path.join(destinationFolder, 'leiningen'));
        core.addPath(path.join(destinationFolder, 'leiningen', 'bin'));
        await exec.exec('lein -h');

        return path.join(destinationFolder, 'leiningen');
    } else {
        throw new Error('Not a file');
    }
}

async function readWriteAsync(
    file: string,
    toReplace: string,
    replacement: string
): Promise<void> {
    fs.readFile(file, 'utf-8', function(err, data) {
        if (err) throw err;

        var newValue = data.replace(toReplace, replacement);

        fs.writeFile(file, newValue, 'utf-8', function(err) {
            if (err) throw err;
        });
    });
}
