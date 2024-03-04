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
    async (voteStr: "yay" | "nay" | "abstain", e) => {
      e.preventDefault();
      e.stopPropagation();
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
    <div className="flex flex-col pointer" onClick={toggleExpand}>
      <div className="flex">
        <div className="relative flex flex-col gap-2 p-4 pb-6 grow">
          <h3 className="mb-2 text-xl font-bold">
            {truncateTitle(proposal.content.title || "")}
          </h3>
          <h4>
            <div className="text-sm">{proposal.author}</div>
            <div className="text-sm">{proposal.content.authors}</div>
          </h4>
          <div className="flex justify-between items-center">
            <div>{truncateTitle(proposal?.content?.abstract || "")}</div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between p-4 border-l w-30 shrink-0">
          <span className="" title={proposal.proposalType}>
            {proposal.proposalType.substring(0, 3)} - {proposal.id}
          </span>
          <span>
            {proposal.startEpoch.toString()} - {proposal.endEpoch.toString()}
          </span>
          {proposal.status === "ongoing" && (
            <div className="flex flex-col gap-2">
              <button
                className="p-1 text-sm bg-white text-green-600 rounded-lg border "
                onClick={(e) => vote("yay", e)}
              >
                Yay
              </button>
              <button
                className="p-1 text-sm bg-white text-gray rounded-lg border "
                onClick={(e) => vote("abstain", e)}
              >
                Abstain
              </button>
              <button
                className="p-1 text-sm bg-white text-red-600 rounded-lg border "
                onClick={(e) => vote("nay", e)}
              >
                Nay
              </button>
            </div>
          )}
        </div>
      </div>
      {expanded && (
        <div className="flex flex-col p-4 border-t ">
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
