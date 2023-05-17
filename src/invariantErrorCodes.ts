import { version } from "./version"

const errorObj: {
    "@apollo/client version": string,
    [key: number]: { file: string, condition?: string, message?: string }
} = {
    "@apollo/client version": version
};
export default errorObj
