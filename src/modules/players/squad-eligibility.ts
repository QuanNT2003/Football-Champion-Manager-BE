import { Prisma, players_squad_type } from '@prisma/client';

export const squadAgeLimit = (squadType: string) => squadType === 'YOUTH_U19' ? 19 : squadType === 'YOUTH_U21' ? 21 : null;

/** Age alone never registers a first-team player for the youth squad. */
export function squadPlayerWhere(squadType: string): Prisma.playersWhereInput {
  return { squad_type: squadType as players_squad_type };
}

export function playerBelongsToSquad(player: { squad_type?: string; age?: number }, squadType: string) {
  return (player.squad_type || 'FIRST_TEAM') === squadType;
}
