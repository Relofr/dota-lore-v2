import { AwsClient } from 'aws4fetch'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (request.method !== 'POST')   return new Response('Method not allowed', { status: 405, headers: CORS })

    const { text, debug } = await request.json()

    if (debug) {
      return new Response(JSON.stringify({
        accessKeyStart: env.AWS_ACCESS_KEY?.slice(0, 4),
        accessKeyLen:   env.AWS_ACCESS_KEY?.length,
        secretKeyLen:   env.AWS_SECRET_KEY?.length,
        voice:          env.POLLY_VOICE,
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    const aws = new AwsClient({
      accessKeyId:     env.AWS_ACCESS_KEY,
      secretAccessKey: env.AWS_SECRET_KEY,
      region:          'us-east-1',
      service:         'polly',
    })

    try {
      const resp = await aws.fetch('https://polly.us-east-1.amazonaws.com/v1/speech', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          Engine:       'neural',
          OutputFormat: 'mp3',
          TextType:     'ssml',
          Text:         `<speak><prosody rate="85%">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</prosody></speak>`,
          VoiceId:      'Ruth',
        }),
      })

      if (!resp.ok) {
        const err = await resp.text()
        return new Response(err, { status: resp.status, headers: CORS })
      }

      return new Response(resp.body, {
        headers: { ...CORS, 'Content-Type': 'audio/mpeg' },
      })
    } catch (err) {
      return new Response(err.message, { status: 500, headers: CORS })
    }
  },
}
