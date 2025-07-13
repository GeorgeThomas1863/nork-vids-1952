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

  //--------------------------

  //FIND STUFF

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

  //finds unique items NOT in collection2
  async findNewURLs() {
    //collection1 - OLD THING (compare against); collection2 - NEW THING (process you are currently doing / handling)
    const { collection1, collection2 } = this.dataObject;

    //run check
    const distinctURLs = await db.dbGet().collection(collection2).distinct("url");
    const newURLsArray = await db.dbGet().collection(collection1).find({ ["url"]: { $nin: distinctURLs } }).toArray(); //prettier-ignore
    return newURLsArray;
  }

  //--------------------------

  //GET STUFF

  async getAll() {
    const arrayData = await db.dbGet().collection(this.collection).find().toArray();
    return arrayData;
  }

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

  //updates data (to add vidData)
  async updateObjInsert() {
    const { keyToLookup, itemValue, insertKey, updateObj } = this.dataObject;
    const updateData = await db.dbGet().collection(this.collection).updateOne({ [keyToLookup]: itemValue }, { $set: { [insertKey]: updateObj } }); //prettier-ignore
    return updateData;
  }
}

export default dbModel;
