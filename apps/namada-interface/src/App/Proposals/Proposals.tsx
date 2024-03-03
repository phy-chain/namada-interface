import BigNumber from "bignumber.js";
import * as A from "fp-ts/Array";

import { pipe } from "fp-ts/lib/function";
import { useCallback, useEffect, useState } from "react";
import {
  Proposal,
  ProposalsState,
  fetchProposals,
  setActiveProposal,
} from "slices/proposals";
import { useAppDispatch, useAppSelector } from "store";
// import { ProposalDetails } from "./ProposalDetails";
import { Proposal as ProposalDetails } from "./Proposal";
import {
  ProposalCard,
  ProposalCardVotesContainer,
  ProposalsContainer,
  ProposalsList,
} from "./Proposals.components";

const getStatus = (proposal: Proposal): string => {
  return proposal.status !== "finished" ? proposal.status : proposal.result;
};

const ProposalCardVotes = ({
  yes,
  total,
}: {
  yes: string;
  total: string;
}): JSX.Element => {
  const yesNo = new BigNumber(yes);
  const totalNo = new BigNumber(total);

  const yesPercentage = yesNo.div(totalNo).times(100).toNumber();
  const noPercentage = 100 - yesPercentage;

  return (
    <ProposalCardVotesContainer
      title={`Yes: ${yes}, Total: ${total} (${yesPercentage.toFixed(2)})%`}
      yes={yesPercentage}
      no={noPercentage}
    />
  );
};

export const Proposals = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const { proposals, activeProposalId } = useAppSelector<ProposalsState>(
    (state) => state.proposals
  );

  const [data, setData] = useState(
    {} as {
      ongoing: Proposal[];
      finished: Proposal[];
      upcoming: Proposal[];
    }
  );

  useEffect(() => {
    dispatch(fetchProposals());
  }, []);

  useEffect(() => {
    const searchResults = [] as Proposal[]; // minisearch
    const results = searchResults?.length ? searchResults : proposals;
    const sections =
      results.reduce(
        (acc, pro) => {
          acc[pro.status].push(pro);
          return acc;
        },
        {
          ongoing: [] as Proposal[],
          finished: [] as Proposal[],
          upcoming: [] as Proposal[],
        }
      ) || {};
    setData(sections);
  }, [proposals]);

  const onProposalClick = useCallback((proposalId: string) => {
    dispatch(setActiveProposal(proposalId));
  }, []);

  const onDetailsClose = useCallback(() => {
    dispatch(setActiveProposal());
  }, []);

  const maybeProposal = pipe(
    proposals,
    A.findFirst((p) => p.id === activeProposalId)
  );

  return (
    <ProposalsContainer>
      <h1>Proposals</h1>
      <ProposalsList data-testid="proposals-list">
        {data?.ongoing.map((proposal, i) => (
          <ProposalCard key={i} onClick={() => onProposalClick(proposal.id)}>
            <ProposalDetails proposal={proposal} />
            {/*<ProposalCardInfoContainer>*/}
            {/*{proposal.status === "ongoing" && (*/}
            {/*  <ProposalCardVotes*/}
            {/*    yes={proposal.totalYayPower.toString()}*/}
            {/*    total={proposal.totalVotingPower.toString()}*/}
            {/*  />*/}
            {/*)}*/}
            {/*</ProposalCardInfoContainer>*/}
          </ProposalCard>
        ))}
      </ProposalsList>
      {/*<ProposalDetails*/}
      {/*  open={O.isSome(maybeProposal)}*/}
      {/*  onClose={onDetailsClose}*/}
      {/*  maybeProposal={maybeProposal}*/}
      {/*/>*/}
    </ProposalsContainer>
  );
};
