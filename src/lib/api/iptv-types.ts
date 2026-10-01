// IPTV Types — Matches SEATV.XYZ Stalker Portal API responses

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

export interface IptvVodItem {
  id: string;
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
  descr?: string;
  genre: string;
  genres_str?: string;
  rating_kinopoisk?: string;
  hd?: number | string;
}

export interface IptvCategory {
  id: string;
  title: string;
}

export interface IptvSeriesItem {
  id: string;
  name: string;
  screenshot_uri: string;
  year: string;
  description: string;
  genres_str?: string;
  rating_kinopoisk?: string;
}

export interface IptvRadioStation {
  id: string;
  number: number;
  name: string;
  logo: string;
  url: string;
  genre: string;
}
