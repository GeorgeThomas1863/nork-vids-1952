import axios from "axios";
import { randomDelay } from "../src/util.js";

class KCNA {
  constructor(dataObject) {
    this.dataObject = dataObject;
  }

  //confirm try catch works
  async getHTML() {
    const inputURL = this.dataObject.url;
    if (!inputURL) return null;

    try {
      const res = await axios({
        method: "get",
        url: inputURL,
        timeout: 60000,
        responseType: "text",
      });

      return res.data;
    } catch (e) {
      //AXIOS PRODUCES OWN CUSTOM ERROR
      console.log("GET HTML ERROR");
      console.log("ERROR, for " + inputURL);
      console.log(e);
      return null;
    }
  }

  async getMediaHeaders() {
    const inputURL = this.dataObject.url;
    if (!inputURL) return null;

    //random between up to 200 bytes
    const randomBytes = Math.floor(Math.random() * 200);
    const byteText = "bytes=0-" + randomBytes;
    console.log("BYTES:", randomBytes);

    try {
      const res = await axios({
        method: "get",
        url: inputURL,
        headers: { Range: byteText },
        timeout: 30000,
      });

      const headers = res.headers;
      console.log("GOT FUCKING HEADERS");

      return headers;
    } catch (e) {
      console.log("HEADER ERROR for " + inputURL + "; | RESPONSE: ");
      console.log(e.code);
      //on fail try stream
      const retryModel = new KCNA(this.dataObject);
      const retryData = await retryModel.retryStream();
      return retryData;
    }
  }

  //HEADER RETRY 2
  async retryStream() {
    const inputURL = this.dataObject.url;
    if (!inputURL) return null;

    try {
      // await randomDelay(3);
      const res = await axios({
        method: "get",
        url: inputURL,
        responseType: "stream",
        timeout: 30000,
      });

      const headers = res.headers;
      console.log("GOT FUCKING HEADERS", headers);

      // Immediately abort the stream to prevent downloading the entire file
      res.data.destroy();

      return headers;
    } catch (e) {
      //if still fucked, check if pic and if so try full thing
      if (inputURL.slice(-4) === ".jpg") {
        const finalTryModel = new KCNA(this.dataObject);
        const res = await finalTryModel.retryFullReq();
        return res;
      }

      //otherwise give up
      return null;
    }
  }

  //HEADER RETRY 3
  async retryFullReq() {
    const inputURL = this.dataObject.url;
    if (!inputURL) return null;

    try {
      await randomDelay(3);
      const res = await axios({
        method: "get",
        url: inputURL,
        timeout: 15000, //only wait 15 sec
      });

      const headers = res.headers;

      return headers;
    } catch (e) {
      console.log("TRIED FULL REQ, STILL FUCKED");
      // console.log(e);
      return null;
    }
  }
}

export default KCNA;
