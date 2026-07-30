import type { TutorialStep } from '~/types';

/**
 * On-site tutorial content shown in TutorialDialog, keyed by locale with an
 * `en` fallback (mirrors whatsappChannels). Add a locale block to translate
 * the walkthrough into a new language.
 */
export const tutorialSteps: Record<string, TutorialStep[]> = {
  nl: [
    {
      icon: 'mdi-translate',
      title: 'Kies een taal',
      body: 'Selecteer bovenaan de pagina de taal waarin je video\'s wilt bekijken. De catalogus verschilt per taal.',
    },
    {
      icon: 'mdi-play-circle-outline',
      title: 'Open een video',
      body: 'Klik op een video die je wilt bekijken om de speler te openen. Via de downloadknop in de titelbalk kan je de video- en ondertitelbestanden downloaden.',
    },
    {
      icon: 'mdi-closed-caption-outline',
      title: 'Audio en ondertiteling apart',
      body: 'Onder de video kan je de audiotaal en de ondertitel los van elkaar instellen. Zo kan je bijvoorbeeld de Broadcasting in het Engels bekijken met Nederlandse ondertiteling!',
    },
    {
      icon: 'mdi-text-box-search-outline',
      title: 'Lees mee in het transcript',
      body: 'Met de transcriptknop open je de volledige tekst naast de video. De tekst scrollt mee, je kunt erin zoeken, en door op een zin te klikken spring je meteen naar dat moment.',
    },
    {
      icon: 'mdi-cast',
      title: 'Cast naar je tv',
      body: 'Heb je een Chromecast? Met de castknop stuur je de video, inclusief ondertiteling, rechtstreeks naar je tv.',
    },
  ],
  en: [
    {
      icon: 'mdi-translate',
      title: 'Choose a language',
      body: 'At the top of the page, choose the language you want to browse videos in. The catalog differs per language.',
    },
    {
      icon: 'mdi-play-circle-outline',
      title: 'Open a video',
      body: 'Click on a video you want to watch to open the player. The download button in the title bar lets you download the video and subtitle files.',
    },
    {
      icon: 'mdi-closed-caption-outline',
      title: 'Audio and subtitles separately',
      body: 'Below the video you can set the audio language and the subtitles independently.',
    },
    {
      icon: 'mdi-text-box-search-outline',
      title: 'Read along in the transcript',
      body: 'The transcript button opens the full text next to the video. The text scrolls along, you can search inside it, and clicking on a line jumps straight to that moment.',
    },
    {
      icon: 'mdi-cast',
      title: 'Cast to your TV',
      body: 'Got a Chromecast? The cast button sends the video, subtitles included, straight to your TV.',
    },
  ],
};
