class Store {
    private _currentPattern: string = '';
    get currentPattern(): string {
        return this._currentPattern;
    }
    set currentPattern(value: string) {
        this._currentPattern = value;
    }

    private _migrateName: string = '';
    get migrateName(): string {
        return this._migrateName;
    }
    set migrateName(value: string) {
        this._migrateName = value;
    }

    private _isAnalyzing: boolean = false;
    get isAnalyzing(): boolean {
        return this._isAnalyzing;
    }
    set isAnalyzing(value: boolean) {
        this._isAnalyzing = value;
    }

    private _isImportSession: boolean = false;
    get isImportSession(): boolean {
        return this._isImportSession;
    }
    set isImportSession(value: boolean) {
        this._isImportSession = value;
    }

    private _sourcePassword: string | undefined;
    get sourcePassword(): string | undefined {
        return this._sourcePassword;
    }
    set sourcePassword(value: string | undefined) {
        this._sourcePassword = value;
    }

    private _targetPassword: string | undefined;
    get targetPassword(): string | undefined {
        return this._targetPassword;
    }
    set targetPassword(value: string | undefined) {
        this._targetPassword = value;
    }
}

export const store = new Store();
