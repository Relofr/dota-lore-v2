import { AwsClient } from 'aws4fetch'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function corsResponse(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { ...CORS, ...extra } })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return corsResponse(null)
    if (request.method !== 'POST')   return corsResponse('Method not allowed', 405)

    const { text } = await request.json()

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
        return corsResponse(err, resp.status)
      }

      return corsResponse(resp.body, 200, { 'Content-Type': 'audio/mpeg' })
    } catch (err) {
      return corsResponse(err.message, 500)
    }
  },
}
