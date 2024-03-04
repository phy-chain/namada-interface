import { useCallback, useState } from "react";

import { toast } from "@namada/airdrop/src/App/utils";
import { chains } from "@namada/chains";
import { getIntegration } from "@namada/integrations";
import { AccountType, Signer, Tokens } from "@namada/types";
import BigNumber from "bignumber.js";
import * as O from "fp-ts/Option";
import { Option } from "fp-ts/Option";
import { Proposal as ProposalType } from "slices/proposals";

type Props = { proposal: ProposalType; activeDelegator: Option<string> };
export const Proposal = ({ proposal, activeDelegator }: Props): JSX.Element => {
  const [expanded, setExpanded] = useState(false);

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

      if (O.isNone(activeDelegator)) {
        toast("You dont have any active delegations, you cannot vote");
        throw new Error("No active delegator");
      }

      await signer.submitVoteProposal(
        {
          signer: activeDelegator.value,
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
    [activeDelegator, proposal]
  );

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
