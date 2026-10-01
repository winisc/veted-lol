// Imagens do League of Legends.
// Splash arts: CDN próprio, em alta resolução ({Campeão}_{skin}.webp, ex.: Aatrox_0.webp).
// Ícones de invocador: CommunityDragon (o CDN próprio ainda não tem ícones).
const SPLASH_CDN = 'https://absol.stagespun.dev/cdn'
const PROFILE_ICONS = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons'

export const iconUrl = (iconId: number) => `${PROFILE_ICONS}/${iconId}.jpg`
export const splashUrl = (champion: string, skin = 0) => `${SPLASH_CDN}/${champion}_${skin}.webp`

// Splash art de cada página.
export const pageSplash = {
  home: splashUrl('Jinx'),
  lobby: splashUrl('Ekko'),
  ranking: splashUrl('Kayle'),
  auth: splashUrl('Zed'),
  notFound: splashUrl('Teemo'),
}

// Banner do perfil: um campeão fixo por jogador.
const PROFILE_CHAMPIONS = ['Ahri', 'Garen', 'LeeSin', 'Thresh', 'Lux', 'Darius', 'Ezreal', 'Viego', 'Sett', 'Akali']
export const profileSplash = (userId: number) => splashUrl(PROFILE_CHAMPIONS[userId % PROFILE_CHAMPIONS.length])
