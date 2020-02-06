import dotenv from 'dotenv'
dotenv.config()

const {
    ORIENT_DB_HOST,
    ORIENT_DB_PORT,
    ORIENT_DB_USERNAME,
    ORIENT_DB_PASSWORD,
    ORIENT_DB_NAME
} = process.env

export const ORIENT_DB_OPTIONS = {
    host: ORIENT_DB_HOST,
    port: ORIENT_DB_PORT
}

export const ORIENT_DB_SESSION = {
    name: ORIENT_DB_NAME,
    username: ORIENT_DB_USERNAME,
    password: ORIENT_DB_PASSWORD,
    pool: { max: 10 }
}
