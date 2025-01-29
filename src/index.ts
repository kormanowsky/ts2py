import { execSync, spawn } from "node:child_process";
import { constants as fsC, openSync, rmSync } from "node:fs";
import { Socket } from "node:net";

import { PyInterfaceOptions } from "./interface";

export * from "./interface";

export function makePythonInterface(opts: PyInterfaceOptions) {
    const firstFifoPath = `./ts2py-${new Date().getTime()}.fifo`;
    const secondFifoPath = `./py2ts-${new Date().getTime()}.fifo`;

    execSync(`mkfifo -m 0666 ${firstFifoPath}`);
    execSync(`mkfifo -m 0666 ${secondFifoPath}`);

    const script = `
from sys import argv
from json import loads, dumps


${opts.processFunctions}


if __name__ == "__main__":
    in_fifo_path, out_fifo_path = argv[1:]
    while True:
        call = {}
        with open(in_fifo_path, "r") as in_fifo:
            line = in_fifo.readline()
            while not line.startswith('END'):
                cmd, *args = line.split()
                if cmd == 'CALL':
                    call['func'] = args[0].strip()
                    call['args'] = []
                elif cmd == 'ARG':
                    call['args'].append(loads(line[3:].strip()))
                line = in_fifo.readline()
        with open(out_fifo_path, "w") as out_fifo: 
            out_fifo.write(dumps(globals()[call['func']](*call['args'])) + '__RET_VALUE_END__')
`.trimStart();

    const pyProcess = spawn(
        `python3`, 
        [
            `-c`, 
            script, 
            firstFifoPath,
            secondFifoPath
        ],
        {
            stdio: 'inherit'
        }
    );

    let readData = '';
    let fullReadCb: (data: any) => void = () => null;

    const listener = (data) => {
        readData += data.toString();

        const stopPos = readData.indexOf('__RET_VALUE_END__');

        if (stopPos === -1) {
            return;
        }

        const fullReadData = readData.slice(0, stopPos).trim();
        readData = readData.slice(stopPos + '__RET_VALUE_END__'.length);

        fullReadCb(JSON.parse(fullReadData));
    };

    const inFd = openSync(secondFifoPath, fsC.O_RDONLY | fsC.O_NONBLOCK);
    const inPipe = new Socket({ fd: inFd, readable: true, writable: false });
    inPipe.setEncoding('utf8');
    inPipe.on('data', listener);

    const outFd = openSync(firstFifoPath, fsC.O_WRONLY);
    const outPipe = new Socket({ fd: outFd, readable: false, writable: true });
    outPipe.setEncoding('utf8');

    return {
        call: <TArg = string, TResult = string>(func: string, arg: TArg): Promise<TResult> => 
            new Promise<TResult>((resolve) => {
                fullReadCb = (data) => {
                    resolve(data);
                    fullReadCb = () => null;
                };
                outPipe.write(`CALL ${func}\nARG ${JSON.stringify(arg)}\nEND\n`);
        }),

        cleanup: () => {
            outPipe.destroy();
            inPipe.destroy();
            pyProcess.kill('SIGTERM');
            rmSync(firstFifoPath);
            rmSync(secondFifoPath);
        }
    }
}
