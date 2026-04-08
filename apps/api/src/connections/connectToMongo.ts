import { connect } from 'mongoose';

export const connectToMongoDB = async () => {
    try {
        await connect(process.env.MONGO_URI);
        console.log('[VaultStack] CONNECTED TO DB');
        return true;
    } catch (e) {
        console.log(e);
        throw 'FAILED TO CONNECT TO MONGODB';
    }
};
