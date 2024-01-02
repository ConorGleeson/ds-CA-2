import { SQSHandler } from "aws-lambda";
// import AWS from 'aws-sdk';
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
  throw new Error(
    "Please add the SES_EMAIL_TO, SES_EMAIL_FROM and SES_REGION environment variables in an env.js file located in the root directory"
  );
}

type ContactDetails = {
  name: string;
  email: string;
  message: string;
};

const client = new SESClient({ region: SES_REGION });
export const handler: SQSHandler = async (event: any) => {
  console.log("Event ", event);
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    const snsMessage = JSON.parse(recordBody.Message);

    if (snsMessage.Records) {
      console.log("Record body ", JSON.stringify(snsMessage));
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        const srcKey = decodeURIComponent(s3e.object.key.replace(/+/g, " "));
        try {
          // Check if the uploaded file is an image
          if (!imageCheck(srcKey)) {
            throw new Error("Uploaded file is not an image");
          }

          const { name, email, message }: ContactDetails = {
            name: "The Photo Album",
            email: SES_EMAIL_FROM,
            message:" We received your Image. Its URL is s3://${srcBucket}/${srcKey}",
          };
          const params = sendEmailParams({ name, email, message });
          await client.send(new SendEmailCommand(params));
        } catch (error: unknown) {
          console.log("ERROR is: ", error);
          if (error instanceof Error) {
            const errorMessage = error.message || "Unknown error occurred";
            await sendRejectionEmail(SES_EMAIL_TO, SES_EMAIL_FROM, errorMessage);
          }
        }
      }
    }
  }
};

function sendEmailParams({ name, email, message }: ContactDetails) {
  const parameters: SendEmailCommandInput = {
    Destination: {
      ToAddresses: [SES_EMAIL_TO],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: getHtmlContent({ name, email, message }),
        },
        // Text: {
        //   Charset: "UTF-8",
        //   Data: getTextContent({ name, email, message }),
        // },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `New image Upload`,
      },
    },
    Source: SES_EMAIL_FROM,
  };
  return parameters;
}




function getHtmlContent({ name, email, message }: ContactDetails) {
  return `
    <html>
      <body>
        <h2>Sent from: </h2>
        <ul>
          <li style="font-size:18px">👤 <b>${name}</b></li>
          <li style="font-size:18px">✉️ <b>${email}</b></li>
        </ul>
        <p style="font-size:18px">${message}</p>
      </body>
    </html> 
  `;
}

function getTextContent({ name, email, message }: ContactDetails) {
  return `
    Received an Email. 📬
    Sent from:
        👤 ${name}
        ✉️ ${email}
    ${message}
  `;
}

//method to check filetypes
function imageCheck (file: string) {
  const fileTypes = [".jpeg, .png"]
  const type  = file.toLowerCase().slice(file.lastIndexOf('.'))
  return fileTypes.includes(type)

}

async function sendRejectionEmail(toEmail: string, fromEmail: string, errorMessage: string) {
  const params = {
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `<p>There was an error processing your image. The error is: ${errorMessage}</p>`,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `Error processing your image`,
      },
    },
    Source: fromEmail,
  };

   await client.send(new SendEmailCommand(params));
}