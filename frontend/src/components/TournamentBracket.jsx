import { Trophy, CheckCircle } from "lucide-react";

const ROUNDS_ORDER = ["round_of_16", "quarterfinals", "semifinals", "final"];
const ROUND_LABELS = {
  round_of_16: "Octavos",
  quarterfinals: "Cuartos",
  semifinals: "Semifinales",
  final: "Final",
};

export const TournamentBracket = ({ matches }) => {
  // Get non-empty rounds
  const activeRounds = ROUNDS_ORDER.filter(
    (round) => matches[round] && matches[round].length > 0
  );

  if (activeRounds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay partidos generados aún
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 min-w-max">
        {activeRounds.map((round, roundIndex) => (
          <div key={round} className="flex flex-col">
            {/* Round Header */}
            <div className="text-center mb-4">
              <span className="inline-block px-3 py-1 bg-secondary/10 text-secondary text-sm font-medium rounded-full">
                {ROUND_LABELS[round]}
              </span>
            </div>

            {/* Matches */}
            <div
              className="flex flex-col justify-around flex-1"
              style={{
                gap: `${Math.pow(2, roundIndex) * 16}px`,
                paddingTop: `${Math.pow(2, roundIndex) * 8 - 8}px`,
              }}
            >
              {matches[round]?.map((match) => (
                <MatchCard key={match.match_id} match={match} />
              ))}
            </div>
          </div>
        ))}

        {/* Champion */}
        {activeRounds.includes("final") && matches.final?.[0]?.winner_id && (
          <div className="flex flex-col justify-center">
            <div className="text-center mb-4">
              <span className="inline-block px-3 py-1 bg-accent text-accent-foreground text-sm font-bold rounded-full">
                Campeón
              </span>
            </div>
            <div className="w-48 p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 rounded-xl text-center shadow-lg">
              <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="font-heading font-bold text-lg">{matches.final[0].winner_name}</p>
              <p className="text-sm text-amber-700 font-semibold">1000 pts</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MatchCard = ({ match }) => {
  const isCompleted = match.status === "completed";
  const player1Wins = match.winner_id === match.player1_id;
  const player2Wins = match.winner_id === match.player2_id;

  const formatSets = (sets) => {
    if (!sets || sets.length === 0) return null;
    return sets.map((set, i) => `${set.player1}-${set.player2}`).join(" / ");
  };

  return (
    <div
      className={`w-48 bracket-match ${isCompleted ? "completed" : "pending"}`}
      data-testid={`match-card-${match.match_id}`}
    >
      {/* Player 1 */}
      <div
        className={`p-3 border-b border-border/50 ${
          player1Wins ? "winner-highlight" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm truncate flex-1 ${
              player1Wins ? "font-semibold" : ""
            } ${!match.player1_id ? "text-muted-foreground" : ""}`}
          >
            {match.player1_name || "TBD"}
          </span>
          {player1Wins && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
        </div>
      </div>

      {/* Player 2 */}
      <div
        className={`p-3 ${player2Wins ? "winner-highlight" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm truncate flex-1 ${
              player2Wins ? "font-semibold" : ""
            } ${!match.player2_id ? "text-muted-foreground" : ""}`}
          >
            {match.player2_name || "TBD"}
          </span>
          {player2Wins && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
        </div>
      </div>

      {/* Score */}
      {isCompleted && match.sets && match.sets.length > 0 && (
        <div className="px-3 py-2 bg-muted/50 border-t border-border/50">
          <p className="text-xs text-center text-muted-foreground font-mono">
            {formatSets(match.sets)}
          </p>
        </div>
      )}
    </div>
  );
};

export default TournamentBracket;
