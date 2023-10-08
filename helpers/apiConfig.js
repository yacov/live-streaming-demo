import DID_API from '../api.json' assert { type: 'json' };

const config = {
    avatar: {
      man: {
        source_url: 's3://d-id-images-prod/google-oauth2|112587076384125082124/img_tiTmukGsgloXzi30TOyGj/uae_presenterSmall.png',
        idleVideo: 'M_Idle.mp4'
      },
      woman: {
        source_url: 's3://d-id-images-prod/google-oauth2|112587076384125082124/img_WmsMKDEB8NeMRH3DilBnX/PresenterWomanFinal1.png',
        idleVideo: 'W_idle.mp4'
      }
    },
    language: {
      'en-US': {
        recognitionLang: 'en-US',
        authorizationKey: DID_API.vs_en_key,
        noInformationMessage: 'Sorry, I don\'t have this information',
        voice_id: {
          man: 'en-US-ChristopherNeural',
          woman: 'en-US-JennyNeural'
        }
      },
      'ar': {
        recognitionLang: 'ar',
        authorizationKey: DID_API.vs_ar_key,
        noInformationMessage: 'آسف، ليس لدي هذه المعلومات',
        voice_id: {
          man: 'ar-AE-HamdanNeural',
          woman: 'ar-AE-FatimaNeural'
        }
      }
    }
  };

  export { DID_API, config };
