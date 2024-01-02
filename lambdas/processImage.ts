/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
// import { sharp } from "/opt/nodejs/sharp-utils";
import {
  GetObjectCommand,
  PutObjectCommandInput,
  GetObjectCommandInput,
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const s3 = new S3Client();

export const handler: SQSHandler = async (event) => {
  console.log("Event ", event);
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    const message = JSON.parse(recordBody.Message);
    console.log('Raw SNS message ',JSON.stringify(recordBody))
    if (message.Records) {
      for (const messageRecord of message.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        // Object key may have spaces or unicode non-ASCII characters.
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));
        // Infer the image type from the file suffix.
        const typeMatch = srcKey.match(/\.([^.]*)$/);
        if (!typeMatch) {
          console.log("Could not determine the image type.");
          throw new Error("Could not determine the image type. ");
        }
        // Check that the image type is supported
        const imageType = typeMatch[1].toLowerCase();
        if (imageType !== "jpeg" && imageType !== "png") {
          console.log(`Unsupported image type: ${imageType}`);
          throw new Error(`Unsupported image type: ${imageType}`);
        }
        // process image upload 

        const insert = new PutCommand({
          TableName: "imagesTable",
          Item: {
            Name: srcKey,

          },
        });

        const Output = await ddbDocClient.send(insert);
      }
    }
  }
};

function creatDDbDocClient(){
  const ddbClient = new DynamoDBClient({region: process.env.REGiON});
  const marshallOptions = {
    convertEmptyValues: true, 
    removeUndefinedValues: true,
    convertClassInstanceToMap: true
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = {marshallOptions, unmarshallOptions};
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}