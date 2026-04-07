import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

window.Pusher = Pusher

export const createEcho = (apiToken: string, backendUrl: string): Echo<any> => {
  return new Echo({
    broadcaster: 'pusher',
    key: 'b7213b1ac428f4724e16',
    cluster: 'ap1',
    forceTLS: true,
    authEndpoint: `${backendUrl}/broadcasting/auth`,
    authTransport: 'ajax',
    auth: {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'application/json'
      }
    }
  })
}
