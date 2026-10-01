<script setup>
import { useId } from 'vue'

const uid = useId()
const id = name => `${uid}-${name}`
</script>

<template>
  <svg viewBox="0 0 60 60" aria-hidden="true">
    <rect width="60" height="60" rx="30" :fill="`url(#${id('circleOutline')})`" />
    <path fill-rule="evenodd" d="M56.72 30C56.72 15.253 44.747 3.28 30 3.28S3.279 15.253 3.279 30 15.252 56.721 30 56.721 56.72 44.748 56.72 30z" fill="hsl(0,0%,0%)" />
    <path d="M39.071 36.287a.72.72 0 01.53.22c.146.147.22.324.22.532a.72.72 0 01-.22.531c-.147.146-.323.219-.53.219s-.385-.073-.532-.219a.72.72 0 01-.22-.531c0-.208.073-.385.22-.532s.324-.22.532-.22zm.001.118a.61.61 0 00-.635.634c0 .175.062.324.186.447a.61.61 0 00.449.185.609.609 0 00.446-.185.61.61 0 00.185-.447.61.61 0 00-.185-.448.609.609 0 00-.446-.185zm-.026.148c.111 0 .197.023.257.07s.091.11.091.19c0 .065-.021.121-.064.167s-.102.077-.178.093v.004c.053.012.105.071.158.177l.125.254h-.173l-.104-.229c-.053-.115-.109-.173-.17-.173h-.065v.402h-.146v-.955h.269zm-.029.124h-.094v.307h.118c.132 0 .198-.051.198-.154 0-.059-.018-.099-.053-.121s-.092-.032-.168-.032z" :fill="`url(#${id('circledR')})`" />
    <path d="M30.291 19.96l8.88 5.894v.723l-.603-.134-1.273 11.978s6.028 1.201 9.712 3.870c0 0-6.686-2.636-13.718-2.769V32.4h1.424l-4.420-3.303V19.960zm0-4.691l1.381 1.177v2.941l1.420 1.117.422-2.687 2.142 1.880v2.532l1.243.896.488-2.267 1.731 1.294-.4 2.875-8.427-5.816v-3.942z" :fill="`url(#${id('rightCastle')})`" />
    <path d="M29.727 19.96v9.136l-4.42 3.303h1.424v7.123c-7.032.134-13.718 2.769-13.718 2.769 3.684-2.669 9.711-3.870 9.711-3.870L21.45 26.444l-.602.134v-.723l8.879-5.894zm0-4.691v3.942l-8.428 5.816-.399-2.875 1.731-1.294.488 2.267 1.243-.896v-2.532l2.141-1.880.422 2.687 1.421-1.117v-2.941l1.381-1.177z" :fill="`url(#${id('leftCastle')})`" />
    <defs>
      <linearGradient :id="id('circleOutline')" x1="18.486" y1="30" x2="60.25" y2="59.097" gradientUnits="userSpaceOnUse">
        <stop stop-color="hsl(190,90%,43%)" />
        <stop offset="1" stop-color="hsl(189,91%,31%)" />
      </linearGradient>
      <linearGradient :id="id('circledR')" x1="38.319" y1="36.287" x2="39.821" y2="37.788" gradientUnits="userSpaceOnUse">
        <stop stop-color="hsl(195,20%,77%)" />
        <stop offset="1" stop-color="hsl(195,22%,74%)" />
      </linearGradient>
      <linearGradient :id="id('rightCastle')" x1="30.291" y1="15.269" x2="54.47" y2="30.225" gradientUnits="userSpaceOnUse">
        <stop stop-color="hsl(195,20%,77%)" />
        <stop offset="1" stop-color="hsl(195,22%,74%)" />
      </linearGradient>
      <linearGradient :id="id('leftCastle')" x1="18.162" y1="28.78" x2="32.737" y2="35.061" gradientUnits="userSpaceOnUse">
        <stop stop-color="hsl(190,90%,43%)" />
        <stop offset="1" stop-color="hsl(189,91%,31%)" />
      </linearGradient>
    </defs>
  </svg>
</template>
