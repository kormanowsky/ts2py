export interface PyInterfaceOptions {
    processFunctions: string[];
}

export interface PyIntrface {
    call: <TArg = string, TResult = string>(func: string, arg: TArg) => Promise<TResult>;
    cleanup: () => void;
}