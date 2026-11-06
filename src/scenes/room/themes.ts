/*
 * The kitchen finishes, shared by the room (sketch.ts) and the page's finish
 * deck. Plain data: no three.js here, so the page can import it cheaply.
 */
import type { KitchenPart, NotePart } from '@/scenes/room/sketch'

export interface KitchenTheme {
  id: string
  name: string
  note: string
  colors: Record<KitchenPart, string>
  /** what each finish is, for the board and the annotations */
  names: Record<NotePart, string>
}

/* The realistic room's own finish (and its default): clean beige white and black. */
export const MONO_THEME: KitchenTheme = {
  id: 'mono',
  name: 'Beige white & black',
  note: 'Beige-white matte lacquer under black quartz.',
  colors: { cabinets: '#e6ded1', fronts: '#e6ded1', worktop: '#141312', tile: '#f0ebe3', shelf: '#c79f72' },
  names: { cabinets: 'Beige-white matte lacquer', fronts: 'Beige-white matte lacquer', worktop: 'Black quartz', tile: 'Gloss white tile' },
}

export const KITCHEN_THEMES: KitchenTheme[] = [
  {
    id: 'sage',
    name: 'Sage & oak',
    note: 'Matte sage over light oak, quartz on top.',
    colors: { cabinets: '#8e9b85', fronts: '#cba57a', worktop: '#ece8df', tile: '#e9e2d4', shelf: '#cba57a' },
    names: { cabinets: 'Matte sage lacquer', fronts: 'Light oak veneer', worktop: 'Quartz stone', tile: 'Fluted cream tile' },
  },
  {
    id: 'forest',
    name: 'Forest green',
    note: 'Deep forest green with walnut and marble.',
    colors: { cabinets: '#3e5848', fronts: '#7a5337', worktop: '#e9e5dc', tile: '#dde2d8', shelf: '#7a5337' },
    names: { cabinets: 'Forest green lacquer', fronts: 'American walnut', worktop: 'Calacatta marble', tile: 'Pale green zellige' },
  },
  {
    id: 'white',
    name: 'Warm white',
    note: 'Warm white with honey oak and travertine.',
    colors: { cabinets: '#f0eadf', fronts: '#d5b88e', worktop: '#cac2b5', tile: '#f4f0e8', shelf: '#d5b88e' },
    names: { cabinets: 'Warm white lacquer', fronts: 'Honey oak', worktop: 'Grey travertine', tile: 'Gloss white tile' },
  },
  {
    id: 'greige',
    name: 'Greige & graphite',
    note: 'Soft greige with graphite and pale quartz.',
    colors: { cabinets: '#b3aa9b', fronts: '#4a4744', worktop: '#efebe4', tile: '#e2dbcf', shelf: '#8b7864' },
    names: { cabinets: 'Greige matte', fronts: 'Graphite matte', worktop: 'Pale quartz', tile: 'Stone tile' },
  },
  {
    id: 'terracotta',
    name: 'Retro terracotta',
    note: 'A seventies terracotta and cream, terrazzo on top.',
    colors: { cabinets: '#c06a4a', fronts: '#eadcc3', worktop: '#efe6d6', tile: '#e8d2b2', shelf: '#b5885a' },
    names: { cabinets: 'Terracotta lacquer', fronts: 'Cream lacquer', worktop: 'Terrazzo', tile: 'Sand tile' },
  },
]
