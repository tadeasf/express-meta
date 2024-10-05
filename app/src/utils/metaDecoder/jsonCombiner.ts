import moment from 'moment';
import { FacebookIO } from './decoder';

export async function combine_and_convert_json_files(filePaths: string[]): Promise<{ participants: any[], messages: any[] }> {
  try {
    const combinedJson: { participants: any[], messages: any[] } = {
      participants: [],
      messages: [],
    };

    for (const filePath of filePaths) {
      const data = await FacebookIO.decodeFile(filePath);
      if (!combinedJson.participants.length) {
        combinedJson.participants = data.participants;
      }
      combinedJson.messages.push(...data.messages);
    }

    combinedJson.messages.forEach((message) => {
      if (message.timestamp_ms) {
        message.timestamp = moment(message.timestamp_ms).format(
          'HH:mm DD/MM/YYYY'
        );
      }
    });

    combinedJson.messages.sort((a, b) => {
      return moment(a.timestamp, 'HH:mm DD/MM/YYYY').diff(
        moment(b.timestamp, 'HH:mm DD/MM/YYYY')
      );
    });

    return combinedJson;
  } catch (error) {
    console.error('Error while combining JSON files: ', error);
    throw error;
  }
}