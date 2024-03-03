import { chains } from "@namada/chains";
import { getIntegration } from "@namada/integrations";
import { Query } from "@namada/shared";
import { AccountType, Chain, Signer, Tokens } from "@namada/types";
import BigNumber from "bignumber.js";
import * as O from "fp-ts/Option";
import { useCallback, useEffect, useState } from "react";
import { Proposal as ProposalType } from "slices/proposals";
import { AccountsState } from "../../slices/accounts";
import { useAppSelector } from "../../store";

type Props = { proposal: ProposalType };
export const Proposal = ({ proposal }: Props): JSX.Element => {
  const [expanded, setExpanded] = useState(false);

  const { derived } = useAppSelector<AccountsState>((state) => state.accounts);
  const { rpc } = useAppSelector<Chain>((state) => state.chain.config);
  const addresses = Object.keys(derived[chains.namada.id]);
  const [maybeActiveDelegator, setActiveDelegator] = useState<O.Option<string>>(
    O.none
  );

  const toggleExpand = (): void => {
    setExpanded(!expanded);
  };

  const truncateTitle = (title: string): string => {
    if (title.length > 100) {
      return title.substring(0, 100) + "...";
    }
    return title;
  };

  const vote = useCallback(
    async (voteStr: "yay" | "nay" | "abstain") => {
      const integration = getIntegration(chains.namada.id);
      const signer = integration.signer() as Signer;

      await signer.submitVoteProposal(
        {
          // signer: maybeActiveDelegator.value,
          signer: "",
          vote: voteStr,
          proposalId: BigInt(proposal.id),
        },
        {
          token: Tokens.NAM.address || "",
          feeAmount: new BigNumber(0),
          gasLimit: new BigNumber(20_000),
          chainId: chains.namada.chainId,
        },
        AccountType.Mnemonic
      );
    },
    [maybeActiveDelegator, proposal]
  );

  useEffect(() => {
    const fetchData = async (proposal: ProposalType): Promise<void> => {
      const query = new Query(rpc);
      console.log("Fetching delegator votes for", proposal.id);
      // try {
      //   const votes = await query.delegators_votes(BigInt(proposal.id));
      //   setActiveProposalVotes(new Map(votes));
      //
      //   const totalDelegations: Record<string, BigNumber> =
      //     await query.get_total_delegations(addresses, proposal.startEpoch);
      //   const order = pipe(
      //     addresses,
      //     A.filter((address) => {
      //       return pipe(
      //         BigNumber(totalDelegations[address]),
      //         O.fromPredicate((v) => !v.isZero()),
      //         O.isSome
      //       );
      //     })
      //   );
      //
      //   setDelegations(O.some({ delegations: totalDelegations, order }));
      //   setActiveDelegator(O.some(order[0]));
      // } catch (e) {
      //   console.error(e);
      // }
    };

    if (addresses.length > 0 && proposal.status === "ongoing") {
      // fetchData(proposal);
    }
  }, [JSON.stringify(addresses), proposal]);

  return (
    <div
      className="flex flex-col bg-white border border-namada-secondary rounded-2xl shadow-inner pointer"
      onClick={toggleExpand}
    >
      <div className="flex">
        <div className="flex flex-col items-center justify-center shrink-0 w-24 truncate border-r border-namada-secondary p-4">
          <span className="" title={proposal.proposalType}>
            {proposal.proposalType.substring(0, 3)}
          </span>
          <span className="">{proposal.id}</span>
        </div>
        <div className="flex flex-col gap-2 p-4 grow">
          <div className="flex items-center justify-between gap-2">
            <h3 className="mb-2 text-3xl font-bold tracking-tight">
              {truncateTitle(proposal.content.title || "")}
            </h3>
            <h4>
              <div>{proposal.author}</div>
              <div>{proposal.content.authors}</div>
            </h4>
          </div>
          <div className="flex justify-between items-center">
            <div>{truncateTitle(proposal?.content?.abstract || "")}</div>
            {proposal.status === "ongoing" && (
              <div
                className="relative flex gap-2 cursor-not-allowed opacity-50"
                title="Coming soon"
              >
                <div className="absolute inset-0 bg-namada-primary opacity-30 rounded-lg" />
                <button
                  className="py-2.5 px-5 text-sm rounded-lg border border-namada-secondary"
                  onClick={() => vote("yay")}
                >
                  Yay
                </button>
                <button
                  className="py-2.5 px-5 text-sm rounded-lg border border-namada-secondary"
                  onClick={() => vote("abstain")}
                >
                  Abstain
                </button>
                <button
                  className="py-2.5 px-5 text-sm rounded-lg border border-namada-secondary"
                  onClick={() => vote("nay")}
                >
                  Nay
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center p-4 border-l border-namada-secondary">
          {proposal.startEpoch} - {proposal.endEpoch}
        </div>
      </div>
      {expanded && (
        <div className="flex flex-col p-4 border-t border-namada-secondary">
          <div>{proposal.content.abstract}</div>
          <div>{proposal.content.details}</div>
          <pre className="mt-2 p-2 whitespace-pre">
            {JSON.stringify(proposal.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
