const { ATTRIBUTE_KEYS } = require('../../dist/modules/matches/match-engine');
const positionCodes = ['GK', 'LB', 'CB', 'CB', 'RB', 'DM', 'CM', 'CM', 'LW', 'ST', 'RW', 'GK', 'LB', 'CB', 'DM', 'CM', 'LW', 'ST', 'RW', 'CM'];
const staffKeys = ['attacking', 'defending', 'tactical', 'technical', 'fitness', 'gk_stopping', 'youth_dev',
  'man_management', 'motivating', 'discipline', 'determination', 'adaptability', 'judge_ability', 'judge_potential',
  'tac_knowledge', 'scout_network', 'physiotherapy', 'sports_science', 'injury_prevent', 'rehabilitation'];
function engineTeam(id = '10', rating = 60) {
  return {
    id, name: `Club ${id}`, hasUser: false, squadType: 'FIRST_TEAM',
    tactic: { mentality: 'BALANCED', tempo: 50, passingStyle: 'MIXED', pressing: 50, defensiveLine: 50 },
    coaches: ['HEAD_COACH', 'ASSISTANT_COACH', 'FITNESS_COACH', 'GOALKEEPING_COACH', 'PHYSIO'].map((role, i) => ({
      id: `${id}${i + 100}`, name: `Coach ${role}`, role, squadType: 'FIRST_TEAM', attributes: Object.fromEntries(staffKeys.map(k => [k, 60])),
    })),
    players: positionCodes.map((position, i) => ({
      id: `${id}${i + 1}`, name: `Player ${id}-${i}`, position, formationPositionId: i < 11 ? `${i + 1}` : null,
      started: i < 11, isCaptain: i === 5, shirtNumber: i + 1, role: 'STANDARD', duty: 'SUPPORT', ovr: rating,
      positionAbility: 90, attributes: Object.fromEntries(ATTRIBUTE_KEYS.map(k => [k, rating])),
      mentality: { professionalism: 60, determination: 60, complacency: 30, leadership: 60, temperament: 60,
        pressure_handling: 60, loyalty: 60, adaptability: 60, injury_proneness: 50, greed: 50, ambition: 60 },
      traits: {}, status: { condition: 100, fitness: 100, fatigue: 0, morale: 60, form: 60, sharpness: 60 }, instructions: [],
    })),
  };
}
function engineInput(seed = 1) {
  return { seed, home: engineTeam('10'), away: engineTeam('20'),
    rules: { knockout: false, decidingLeg: false, extraTime: false, penalties: false, aggregateHome: 0, aggregateAway: 0 },
    config: { injuryRate: 0, homeAdvantage: 1 },
  };
}
module.exports = { engineTeam, engineInput };
