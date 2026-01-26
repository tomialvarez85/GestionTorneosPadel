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
        {activeRounds.includes("final") && matches.final?.[0]?.winner_pair_id && (
          <div className="flex flex-col justify-center">
            <div className="text-center mb-4">
              <span className="inline-block px-3 py-1 bg-accent text-accent-foreground text-sm font-bold rounded-full">
                Campeón
              </span>
            </div>
            <div className="w-52 p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-300 rounded-xl text-center shadow-lg">
              <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="font-heading font-bold text-lg">{matches.final[0].winner_pair_name}</p>
              <p className="text-sm text-amber-700 font-semibold">1000 pts c/u</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MatchCard = ({ match }) => {
  const isCompleted = match.status === "completed";
  const pair1Wins = match.winner_pair_id === match.pair1_id;
  const pair2Wins = match.winner_pair_id === match.pair2_id;

  const formatSets = (sets) => {
    if (!sets || sets.length === 0) return null;
    return sets.map((set, i) => `${set.pair1}-${set.pair2}`).join(" / ");
  };

  return (
    <div
      className={`w-52 rounded-xl border ${
        isCompleted 
          ? "bg-white border-emerald-200" 
          : "bg-white border-amber-200"
      }`}
      data-testid={`match-card-${match.match_id}`}
    >
      {/* Pair 1 */}
      <div
        className={`p-3 border-b border-border/50 rounded-t-xl ${
          pair1Wins ? "bg-emerald-50" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm truncate flex-1 ${
              pair1Wins ? "font-semibold text-emerald-700" : ""
            } ${!match.pair1_id ? "text-muted-foreground italic" : ""}`}
          >
            {match.pair1_name || "TBD"}
          </span>
          {pair1Wins && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
        </div>
      </div>

      {/* Pair 2 */}
      <div
        className={`p-3 ${pair2Wins ? "bg-emerald-50" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm truncate flex-1 ${
              pair2Wins ? "font-semibold text-emerald-700" : ""
            } ${!match.pair2_id ? "text-muted-foreground italic" : ""}`}
          >
            {match.pair2_name || "TBD"}
          </span>
          {pair2Wins && <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
        </div>
      </div>

      {/* Score */}
      {isCompleted && match.sets && match.sets.length > 0 && (
        <div className="px-3 py-2 bg-muted/50 border-t border-border/50 rounded-b-xl">
          <p className="text-xs text-center text-muted-foreground font-mono">
            {formatSets(match.sets)}
          </p>
        </div>
      )}
    </div>
  );
};

export default TournamentBracket;
