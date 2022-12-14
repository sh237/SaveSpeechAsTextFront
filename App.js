import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, Button } from 'react-native';
import { Audio } from 'expo-av';
import ky from 'ky';
import * as FileSystem from 'expo-file-system';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons'; 
import { FontAwesome5 } from '@expo/vector-icons'; 



export default function App() {
  //オーディオの再生に必要な変数
  const AudioRecorder = useRef(new Audio.Recording());
  const AudioPlayer = useRef(new Audio.Sound());

  //変数の初期化
  const [RecordedURI, SetRecordedURI] = useState('');
  const [AudioPermission, SetAudioPermission] = useState(false);
  const [IsRecording, SetIsRecording] = useState(false);
  const [IsPLaying, SetIsPLaying] = useState(false);
  const [resultText, setResultText] = useState('');
  const [summary, setSummary] = useState('');

  //録音の許可を求める関数の呼び出し
  useEffect(() => {
    GetPermission();
  }, []);

  //録音の許可を求める関数
  const GetPermission = async () => {
    const getAudioPerm = await Audio.requestPermissionsAsync();
    const getRecordPerm = await Audio.requestPermissionsAsync();
    
    if (getAudioPerm.granted && getRecordPerm.granted){
      SetAudioPermission(getAudioPerm.granted);
    }
  };

  //録音の開始をする関数
  const StartRecording = async () => {
    try {
      //録音の許可があるかどうか
      if (AudioPermission === true) {
        try {
          //オーディオの再生に必要な設定
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
          //レコードの準備
          await AudioRecorder.current.prepareToRecordAsync(
            {
              android: {
                extension: '.m4a',
                outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
                audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
                sampleRate: 44100,
                numberOfChannels: 1,
                bitRate: 128000,
              },
              ios: {
                extension: '.caf',
                audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
                sampleRate: 16000,
                numberOfChannels: 1,
                bitRate: 128000,
                linearPCMBitDepth: 16,
                linearPCMIsBigEndian: false,
                linearPCMIsFloat: false,
              }
            }
          );
          //録音の開始
          await AudioRecorder.current.startAsync();
          SetIsRecording(true);
        } catch (error) {
          console.log(error);
        }
      } else {
        //録音の許可がない場合は許可を求める
        GetPermission();
      }
    } catch (error) {
      console.log(error);
    }
  };

  //録音の停止をする関数
  const StopRecording = async () => {
    try {
      //録音の停止
      await AudioRecorder.current.stopAndUnloadAsync();

      //録音した音声のURIを取得
      const result = AudioRecorder.current.getURI();
      if (result) SetRecordedURI(result);

      //録音の状態を変更
      AudioRecorder.current = new Audio.Recording();

      const fileType = 'audio/x-caf'; // cafファイルのMIMEタイプ
      const fileName = result.split('/').pop();
      const fileData = await FileSystem.readAsStringAsync(result, {encoding: FileSystem.EncodingType.Base64});
      const file = new File([fileData], fileName, {type: fileType});
      
      let url = `http://localhost:8000/api/speech2text/${fileName}`; // POST先のURL

      // 送信するデータをセット
      const formData = new FormData();
      formData.append('file', {
        uri: result,
        name: fileName,
        type: 'audio/x-caf',
      });
      // POST送信
      let response = await ky.post(url, {
        body: formData,
        headers: {
          'content-type': 'multipart/form-data',
        }
      });
      //音声認識の結果を取得
      const json = await response.json();
      const parsed_json = JSON.parse(json);
      const text = parsed_json.result[0];
      setResultText(text);
      url = `http://localhost:8000/api/summary`; // POST先のURL
      //文章要約を行うAPIにPOST送信
      let response_summary = await ky.post(url, {
        body: JSON.stringify({"data": text}),
        headers: {
          'content-type': 'application/json',
        }
      });
      //文章要約の結果を取得
      const json_summary = await response_summary.json();
      const parsed_json_summary = JSON.parse(json_summary);
      const summary = parsed_json_summary.result;
      setSummary(summary);
      SetIsRecording(false);
    } catch (error) {
      console.log(error);
    }
  };

  //録音した音声を再生する関数
  const PlayRecordedAudio = async () => {
    try {
      //録音した音声を再生
      await AudioPlayer.current.loadAsync({ uri: RecordedURI }, {}, true);

      //プレイヤーの状態を取得
      const playerStatus = await AudioPlayer.current.getStatusAsync();

      //音声が再生されていない場合は再生する
      if (playerStatus.isLoaded) {
        if (playerStatus.isPlaying === false) {
          AudioPlayer.current.playAsync();
          SetIsPLaying(true);
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  //再生中の音声を停止する関数
  const StopPlaying = async () => {
    try {
      //プレイヤーの状態を取得
      const playerStatus = await AudioPlayer.current.getStatusAsync();
      
      //音声が再生されている場合は停止する
      if (playerStatus.isLoaded === true)
        await AudioPlayer.current.unloadAsync();

      SetIsPLaying(false);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.header_text}>音声認識アプリ</Text>
      </View>
      <View style={styles.icon_container}>
      {IsRecording ? (
        <>
        <Text style={styles.text}>停止</Text>
      <MaterialCommunityIcons style={styles.icon} name="record-rec" size={50} color="black" onPress={StopRecording }/></>) : (
        <>
        <Text style={styles.text}>録音</Text>
        <MaterialCommunityIcons style={styles.icon}  name="record-circle" size={50} color="black" onPress={StartRecording}/></>)}
      {IsPLaying ? (
        <>
        <Text style={styles.text}>停止</Text>
      <FontAwesome5 style={styles.icon} name="stop-circle" size={50} color="black" onPress={StopPlaying}/></>) : (
        <>
        <Text style={styles.text}>再生</Text>
        <Ionicons style={styles.icon} name="play-circle-sharp" size={50} color="black" onPress={PlayRecordedAudio}/></>
      )}
      </View>
      {summary &&
      <Text style={styles.result_title}>要約</Text>}
      {summary &&
      <>
      <View style={styles.result_container}>
      <Text  style={styles.result_text}>{summary}</Text>
      </View>
      </>}
      {resultText &&
      <Text style={styles.result_title}>結果</Text>}
      {resultText && 
      <>
      <View style={styles.result_container}>
      <Text  style={styles.result_text}>{resultText}</Text>
      </View>
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf0f1',
    backgroundColor: '#e6e6e6',
  },
  header: {
    height: 120,
    paddingTop: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'lightblue',
    borderRadius: 10,
    shadowRadius: 10,
    shadowColor: 'black',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5, 
  },
  header_text: {
    fontSize: 30,
    fontFamily: "Hiragino Sans",
    fontWeight: "bold",
    color: '#666666',
  },
  icon_container: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    justifySelf: 'center',
    marginTop: 50,
  },
  icon: {
    alignSelf: 'center',
    justifyContent: 'center',
  },
  text:{
    alignSelf: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontFamily: "Hiragino Sans",
    fontWeight: "bold",
    color: '#666666',
  },
  result_container: {
    marginTop : 5, 
    marginLeft: 20,
    justifyContent: 'center',
    justifySelf: 'center',
    padding: 10,
    width: "90%",
    borderRadius: 4,
    borderColor: '#666666',
    borderWidth: 1,
  },
  result_title: {
    marginTop : 10,
    alignSelf: 'center',
    fontSize: 30,
    fontFamily: "Hiragino Sans",
    fontWeight: "bold",
    color: '#666666',
  },
  result_text: {
    alignSelf: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontFamily: "Hiragino Sans",
    fontWeight: "bold",
    color: '#666666',
  }
});
