export class ResponseHandler {
    constructor(public data: any = null, public error: any = null) {
        this.data = data;
        this.error = error;
    }
}
