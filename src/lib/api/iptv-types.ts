// IPTV Types — Matches SEATV.XYZ Stalker Portal API responses

export interface IptvChannelRaw {
  id: string;
  number: number;
  name: string;
  logo: string;
  icon: string;
  tv_genre_id: number;
  epg_id: string;
  url: string;
  cmd: string;
  censored: number;
  hd: number;
  use_http_tmp_link: number;
  use_load_balancing: number;
  enable_tv_archive: number;
  archive_range: number;
  mc_cmd: string;
  stream_id: number;
  tv_archive_type: number;
  quality: string;
  region: string;
  lang: string;
}

export interface IptvChannel {
  id: string;
  number: number;
  name: string;
  logo: string;
  icon: string;
  genreId: number;
  genre: string;
  epgId: string;
  isHd: boolean;
  quality: string;
  region: string;
  language: string;
  streamUrl: string;
  allowArchive: boolean;
}

export interface IptvGenre {
  id: string;
  title: string;
  number: number;
  alias: string;
}

export interface IptvEpgProgram {
  id: string;
  name: string;
  ch_id: string;
  start: string;
  stop: string;
  start_timestamp: number;
  stop_timestamp: number;
  description: string;
  category: string;
  genre: string;
}

export interface IptvEpgResponse {
  total: number;
  epg: Record<string, IptvEpgProgram[]>;
}

export interface IptvShortEpgItem {
  id: string;
  name: string;
  start: string;
  stop: string;
  start_timestamp: number;
  stop_timestamp: number;
  nowPlaying: boolean;
}

export interface IptvVodItem {
  id: number;
  name: string;
  screenshot_uri: string;
  time: string;
  added: string;
  rating_imdb: string;
  year: string;
  country: string;
  director: string;
  actors: string;
  description: string;
  genre: string;
}

export interface IptvSeriesItem {
  id: number;
  name: string;
  screenshot_uri: string;
  year: string;
  description: string;
}

export interface IptvRadioStation {
  id: string;
  number: number;
  name: string;
  logo: string;
  url: string;
  genre: string;
}

export interface IptvAccountInfo {
  login: string;
  fname: string;
  phone: string;
  stb_type: string;
  tariff_plan: string;
  end_date: string;
  account_balance: string;
  subscribed: number;
}

export interface IptvStreamUrl {
  url: string;
  playToken?: string;
}