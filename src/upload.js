import fs from "fs";
import fsPromises from "fs/promises";
import FormData from "form-data";

import CONFIG from "../config/config.js";
import dbModel from "../models/db-model.js";
import { scrapeState } from "./state.js";
import { tgSendMessage, tgPostPicFS, tgPostVidFS, tgEditMessageCaption } from "./tg-api.js";

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const uploadNewVids = async () => {
  const { kcnaWatchDownloaded, kcnaWatchUploaded } = CONFIG;
  if (!scrapeState.scrapeActive) return null;

  const newVidParams = {
    collection1: kcnaWatchDownloaded,
    collection2: kcnaWatchUploaded,
  };

  const newVidModel = new dbModel(newVidParams, "");
  const newVidArray = await newVidModel.findNewURLs();
  if (!newVidArray || !newVidArray.length) return null;

  const vidUploadData = await uploadVidArray(newVidArray);

  return vidUploadData;
};

export const uploadVidArray = async (inputArray) => {
  if (!inputArray || !inputArray.length) return null;

  const uploadDataArray = [];
  // for (let i = 0; i < inputArray.length; i++) {
  for (let i = 0; i < 1; i++) {
    if (!scrapeState.scrapeActive) return null;
    try {
      const vidUploadObj = await uploadVidItem(inputArray[i]);
      if (!vidUploadObj) continue;

      uploadDataArray.push(vidUploadObj);
    } catch (e) {
      console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
      console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
    }
  }

  return uploadDataArray;
};

export const uploadVidItem = async (inputObj) => {
  if (!inputObj || !inputObj.vidSaveFolder) return null;
  const { thumbnailSavePath, vidSaveFolder, vidData, vidName } = inputObj;
  const { tgUploadId, vidUploadNumber } = CONFIG;

  //check first if vid exists
  if (!fs.existsSync(vidSaveFolder)) {
    const error = new Error("VID NOT DOWNLOADED");
    error.function = "uploadVidItem";
    error.content = inputObj;
    throw error;
  }

  //send title as MESSAGE first (thumbnail looks terrible)
  const titleCaption = await buildCaptionText(inputObj, "title");

  const titleParams = {
    chatId: tgUploadId,
    text: titleCaption,
  };

  const titleData = await tgSendMessage(titleParams);
  if (!titleData || !titleData.result) return null;

  const vidChunkArray = await getVidChunksFromFolder(inputObj);

  console.log("VID CHUNK ARRAY");
  console.log(vidChunkArray);
  console.log("--------------------------------");

  const vidUploadArray = await combineVidChunks(vidChunkArray, inputObj);

  console.log("VID UPLOAD ARRAY");
  console.log(vidUploadArray);
  console.log("--------------------------------");

  //HERE!!!

  // if (!vidUploadArray || !vidUploadArray.length) return null;

  // vidChunkArray.sort((a, b) => {
  //   const aName = path.basename(a, path.extname(a));
  //   const bName = path.basename(b, path.extname(b));
  //   return aName - bName;
  // });

  //upload vid
  // const vidParams = {
  //   vidName: vidName,
  //   vidSavePath: vidSaveFolder + outputFileName,
  // };
};

export const buildCaptionText = async (inputObj, captionType = "title") => {
  if (!inputObj || !captionType) return null;
  const { date, type, title } = inputObj;

  const dateNormal = new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const titleNormal = `<b>${title} ${type}</b>`;

  let captionText = "";
  switch (captionType) {
    case "title":
      const titleStr = "🇰🇵 🇰🇵 🇰🇵";
      captionText = `--------------\n\n${titleStr} ${titleNormal} ${titleStr}\n\n--------------`;
      return captionText;

    case "pic":
      const picTitleStr = "🇰🇵 🇰🇵 🇰🇵" + "\n\n";
      captionText = `${picTitleStr}--------------\n\n${titleNormal}\n<i>${dateNormal}</i>\n\n--------------`;
      return captionText;

    case "vid":
      break;
  }
};

export const getVidChunksFromFolder = async (inputObj) => {
  if (!inputObj || !inputObj.vidSaveFolder) return null;
  const { vidSaveFolder } = inputObj;
  const { vidUploadNumber } = CONFIG;

  //get vids from folder
  const chunkNameArrayRaw = await fsPromises.readdir(vidSaveFolder);
  if (!chunkNameArrayRaw || !chunkNameArrayRaw.length) return null;

  //loop through and pull out arrays of JUST vid chunks with length vidUploadNumber
  const vidChunkArray = [];
  let combineArray = [];
  for (let i = 0; i < chunkNameArrayRaw.length; i++) {
    const chunkName = chunkNameArrayRaw[i];
    const chunkPath = `${vidSaveFolder}${chunkName}`;

    //fail conditions
    if (!fs.existsSync(chunkPath) || !chunkName.endsWith(".mp4") || !chunkName.startsWith("chunk_")) continue;
    combineArray.push(chunkPath);

    if (combineArray.length !== vidUploadNumber) continue;
    vidChunkArray.push(combineArray);
    combineArray = [];
  }

  //add last item to array
  if (combineArray.length) vidChunkArray.push(combineArray);

  return vidChunkArray;
};

//loop through and upload in groups of 20
export const combineVidChunks = async (inputArray, inputObj) => {
  if (!inputArray || !inputArray.length) return null;
  const { vidSaveFolder, vidName } = inputObj;
  const { vidUploadNumber } = CONFIG;

  // console.log("INPUT ARRAY");
  // console.log(inputArray);
  // console.log("--------------------------------");

  const vidUploadArray = [];
  for (let i = 0; i < inputArray.length; i++) {
    for (let j = 0; j < inputArray[i].length; j++) {
      // const chunkItem = inputArray[i][j];

      // console.log("CHUNK ITEM");
      // console.log(chunkItem);
      // console.log("--------------------------------");

      const uploadIndex = Math.floor(i / vidUploadNumber) + 1;
      const outputFileName = `${vidName}_${uploadIndex}.mp4`;

      let concatList = "";
      for (const chunk of inputArray[i]) {
        concatList += `file '${chunk}' \n`;
      }

      fs.writeFileSync(`${vidSaveFolder}concat_list.txt`, concatList);
      const vidUploadPath = `${vidSaveFolder}${outputFileName}`;

      const cmd = `ffmpeg -f concat -safe 0 -i ${vidSaveFolder}concat_list.txt -c copy ${vidUploadPath}`;
      console.log("CMD");
      console.log(cmd);

      await execAsync(cmd);

      fs.unlinkSync(`${vidSaveFolder}concat_list.txt`);

      vidUploadArray.push(vidUploadPath);
    }
  }
  return vidUploadArray;
};
//uploads thumbnail and vid SEPARATELY (might want to change)
// export const uploadVidFS = async (inputObj) => {
//   if (!inputObj) return null;
//   const { thumbnailSavePath, vidSavePath, date, vidData, vidName } = inputObj;
//   const { vidSizeBytes, vidSizeMB } = vidData;
//   const { uploadChunkSize, tgUploadId } = CONFIG;

//   // console.log("UPLOAD CHUNK SIZE");
//   // console.log(uploadChunkSize);
//   // console.log("--------------------------------");

//   const uploadChunks = Math.ceil(vidSizeBytes / uploadChunkSize);

//   // console.log("UPLOAD CHUNKS");
//   // console.log(uploadChunks);
//   // console.log(vidSizeMB + "MB");
//   // console.log("--------------------------------");

//   //check if vid downloaded
//   // if (!fs.existsSync(thumbnailSavePath) || !fs.existsSync(vidSavePath)) {
//   if (!fs.existsSync(vidSavePath)) {
//     const error = new Error("VidNOT downloaded");
//     error.function = "uploadVidFS";
//     error.content = inputObj;
//     throw error;
//   }

//   // //upload vid
//   const vidParams = {
//     thumbnailPath: thumbnailSavePath,
//     uploadChunkSize: uploadChunkSize,
//     vidSizeBytes: vidSizeBytes,
//     uploadChunks: uploadChunks,
//     vidName: vidName,
//     savePath: vidSavePath,
//     tgUploadId: tgUploadId,
//   };

//   const uploadChunkData = await uploadVidChunk(vidParams);

//   // console.log("VID PARAMS");
//   // console.log(vidParams);
//   // console.log("--------------------------------");

//   // console.log("VID UPLOAD DATA");s
//   // console.log(vidUploadData);
//   // console.log("--------------------------------");

//   // if (!vidUploadData) return null;
// };

// export const uploadVidChunk = async (inputObj) => {
//   if (!inputObj) return null;
//   const { thumbnailPath, uploadChunkSize, uploadChunks, vidName, savePath, dateNormal, vidSizeBytes, tgUploadId } = inputObj;

//   const chunkObj = { ...inputObj };

//   // console.log("upload VIDFS CHUNK SIZE");
//   // console.log(uploadChunkSize);
//   // console.log("--------------------------------");

//   const chunkDataArray = [];
//   for (let i = 0; i < uploadChunks; i++) {
//     if (!scrapeState.scrapeActive) return null;
//     try {
//       //define chunk start end
//       const start = i * uploadChunkSize;
//       const end = Math.min(vidSizeBytes, start + uploadChunkSize);

//       chunkObj.start = start;
//       chunkObj.end = end;
//       chunkObj.chunkNumber = i; //THIS WILL BREAK THINGS

//       // chunkParams.chunkStart = i * uploadChunkSize;
//       // chunkParams.chunkEnd = Math.min(vidSizeBytes, chunkParams.chunkStart + uploadChunkSize);
//       // chunkParams.chunkLength = chunkParams.chunkEnd - chunkParams.chunkStart;
//       // chunkParams.chunkNumber = i + 1; //THIS WILL BREAK THINGS

//       console.log("++++++++++++++++++++++++");
//       console.log(`NEW CHUNK! CHUNK START: ${start} | CHUNK END: ${end} | CHUNK NUMBER: ${chunkObj.chunkNumber}`);

//       console.log("CHUNK OBJ");
//       console.log(chunkObj);

//       const chunkForm = await buildChunkForm(chunkObj);

//       console.log("CHUNK FORM");
//       console.log(chunkForm);
//       console.log("--------------------------------");

//       const chunkPostData = await tgPostVidFS({ form: chunkForm });
//       if (!chunkPostData) continue;

//       chunkDataArray.push(chunkPostData);
//     } catch (e) {
//       console.log(`\nERROR! ${e.message} | FUNCTION: ${e.function} \n\n --------------------------------`);
//       console.log(`\nARTICLE HTML: ${e.content} \n\n --------------------------------\n`);
//     }
//   }

//   return chunkDataArray;
// };

// export const buildChunkForm = async (inputObj) => {
//   const { savePath, tgUploadId, thumbnailPath, start, end, chunkNumber, uploadChunks } = inputObj;

//   const readStream = fs.createReadStream(savePath, { start: start, end: end - 1 });

//   // Create form data for this chunk
//   const formData = new FormData();
//   formData.append("chat_id", tgUploadId);
//   formData.append("video", readStream, {
//     filename: `chunk_${chunkNumber}_of_${uploadChunks}.mp4`,
//     knownLength: end - start,
//   });

//   // console.log(`UPLOADING CHUNK ${chunkNumber} of ${uploadChunks}`);
//   // console.log(`CHUNK SIZE: ${chunkEnd - chunkStart}`);
//   // console.log("--------------------------------");

//   //set setting for auto play / streaming
//   formData.append("supports_streaming", "true");
//   formData.append("width", "1280");
//   formData.append("height", "720");

//   //add thumbnail
//   // formData.append("thumb", fs.createReadStream(thumbnailPath));

//   return formData;
// };

//  //upload thumbnail
//  const picParams = {
//   picId: vidName,
//   savePath: thumbnailSavePath,
//   tgUploadId: tgUploadId,
// };

// const uploadPicData = await uploadPicFS(picParams);
// console.log("PIC UPLOAD DATA");
// console.log(uploadPicData);
// console.log("--------------------------------");

// if (!uploadPicData) return null;

// return uploadPicData;

// //WORKS BUT THUMBNAIL LOOKS LIKE SHIT
// export const uploadPicFS = async (inputObj) => {
// const { picId, savePath, tgUploadId } = inputObj;

// //build pic params
// const picParams = {
//   chatId: tgUploadId,
//   picPath: savePath,
// };

// const picData = await tgPostPicFS(picParams);
// if (!picData || !picData.result) return null;

// // build caption
// const caption = await buildCaptionText(inputObj, "pic");

// //build edit caption params
// const editParams = {
//   editChannelId: picData.result.chat.id,
//   messageId: picData.result.message_id,
//   caption: caption,
// };

// const editCaptionData = await tgEditMessageCaption(editParams);
// return editCaptionData;
// };

//--------------------

// const start = i * uploadChunkSize;
// const end = Math.min(vidSizeBytes, start + uploadChunkSize);

//build chunk params
// const chunkParams = {
//   chunkStart: start,
//   chunkEnd: end,
//   chunkNumber: i,
//   uploadChunks: uploadChunks,
//   savePath: savePath,
//   tgUploadId: tgUploadId,
//   thumbnailPath: thumbnailPath,
// };s

//PIC UPLOAD WORKS BUT SKIPPING BC UNNECESSARY [reformat later]

//make an item NORMAL here (for label)

// const dateNormal = new Date(date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

// //upload thumbnail
// const picParams = {
//   picId: itemId,
//   savePath: thumbnailSavePath,
//   dateNormal: dateNormal,
//   tgUploadId: tgUploadId,
// };

// const picUploadData = await uploadPicFS(picParams);
// console.log("PIC UPLOAD DATA");
// console.log(picUploadData);
// console.log("--------------------------------");

// if (!picUploadData) return null;
