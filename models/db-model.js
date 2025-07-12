//import mongo
import * as db from "../config/db.js";

//connect to db AGAIN here just to be safe
await db.dbConnect();

class dbModel {
  constructor(dataObject, collection) {
    this.dataObject = dataObject;
    this.collection = collection;
  }

  //STORE STUFF

  async storeAny() {
    // await db.dbConnect();
    const storeData = await db.dbGet().collection(this.collection).insertOne(this.dataObject);
    return storeData;
  }

  async storeUniqueURL() {
    // await db.dbConnect();
    await this.urlNewCheck(); //check if new (throws error if not)

    const storeData = await this.storeAny();
    return storeData;
  }

  async urlNewCheck() {
    const alreadyStored = await db.dbGet().collection(this.collection).findOne({ url: this.dataObject.url });

    if (alreadyStored) {
      const error = new Error("URL ALREADY STORED");
      error.url = this.dataObject.url;
      error.function = "Store Unique URL";
      throw error;
    }

    //otherwise return trun
    return true;
  }

  //GET STUFF
  async getUniqueArray() {
    const { keyToLookup, itemValue } = this.dataObject;
    const dataArray = await db.dbGet().collection(this.collection).find({ [keyToLookup]: itemValue }).toArray(); //prettier-ignore
    return dataArray;
  }

  //UPDATES STUFF
  async updateLog() {
    const { inputObj, scrapeId } = this.dataObject;
    const updateData = await db.dbGet().collection(this.collection).updateMany({ _id: scrapeId }, { $set: { ...inputObj } }); //prettier-ignore
    return updateData;
  }
}

export default dbModel;
