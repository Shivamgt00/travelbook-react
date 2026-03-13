import { Client, Account, Databases, Storage } from 'appwrite';

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1') 
    .setProject('69af5a9c00222a256e62'); //

export const storage = new Storage(client);
export const account = new Account(client);
export const databases = new Databases(client);
export default client;
export { ID } from 'appwrite';