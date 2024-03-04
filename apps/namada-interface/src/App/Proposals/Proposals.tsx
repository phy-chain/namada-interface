import BigNumber from "bignumber.js";
import * as A from "fp-ts/Array";

import { pipe } from "fp-ts/lib/function";
import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { useMiniSearch } from "react-minisearch";

import { chains } from "@namada/chains";
import { Loading } from "@namada/components";
import { getIntegration } from "@namada/integrations";
import { Query } from "@namada/shared";
import { AccountType, Chain, Signer, Tokens } from "@namada/types";
import * as O from "fp-ts/Option";
import {
  Proposal,
  ProposalsState,
  fetchProposals,
  setActiveProposal,
} from "slices/proposals";
import { useAppDispatch, useAppSelector } from "store";
import { StakingAndGovernanceState } from "../../slices/StakingAndGovernance";
import { fetchEpoch } from "../../slices/StakingAndGovernance/actions";
import { AccountsState } from "../../slices/accounts";
import { actions as notificationsActions } from "../../slices/notifications";
import { Proposal as ProposalDetails } from "./Proposal";
import {
  ProposalCard,
  ProposalCardVotesContainer,
  ProposalsContainer,
  ProposalsList,
} from "./Proposals.components";

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

const miniSearchOptions = {
  fields: ["id", "author", "content.authors", "content.abstract"],
  storeFields: ["id"],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractField: (document: any, fieldName: any) => {
    // @ts-expect-error unknown inner object structure, doesnt matter
    return fieldName.split(".").reduce((doc, key) => doc && doc[key], document);
  },
};

export const Proposals = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const { proposals, activeProposalId } = useAppSelector<ProposalsState>(
    (state) => state.proposals
  );

  const { derived } = useAppSelector<AccountsState>((state) => state.accounts);
  const { epoch } = useAppSelector<StakingAndGovernanceState>(
    (state) => state.stakingAndGovernance
  );

  const { rpc } = useAppSelector<Chain>((state) => state.chain.config);
  const addresses = Object.keys(derived[chains.namada.id]);
  const [maybeActiveDelegator, setActiveDelegator] = useState<O.Option<string>>(
    O.none
  );

  const {
    search,
    searchResults = [],
    addAll,
    removeAll,
  } = useMiniSearch(proposals, miniSearchOptions);

  const [data, setData] = useState(
    {} as {
      ongoing: Proposal[];
      ended: Proposal[];
      upcoming: Proposal[];
    }
  );

  useEffect(() => {
    dispatch(fetchEpoch());
    dispatch(fetchProposals());
  }, []);

  useEffect(() => {
    if (proposals?.length) {
      removeAll();
      addAll(proposals);
    }

    const results = searchResults?.length ? searchResults : proposals;
    const sections =
      results.reduce(
        (acc, pro) => {
          acc[pro.status].push(pro);
          return acc;
        },
        {
          ongoing: [] as Proposal[],
          ended: [] as Proposal[],
          upcoming: [] as Proposal[],
        }
      ) || {};
    setData(sections);
  }, [proposals, searchResults]);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      const query = new Query(rpc);
      try {
        //   const votes = await query.delegators_votes(BigInt(proposal.id));
        //   setActiveProposalVotes(new Map(votes));
        //
        if (!epoch) throw new Error("Voting is closed");

        const totalDelegations: Record<string, BigNumber> =
          await query.get_total_delegations(
            addresses,
            BigInt(epoch.toString())
          );
        const order = pipe(
          addresses,
          A.filter((address) => {
            return pipe(
              BigNumber(totalDelegations[address]),
              O.fromPredicate((v) => !v.isZero()),
              O.isSome
            );
          })
        );
        //
        //   setDelegations(O.some({ delegations: totalDelegations, order }));
        setActiveDelegator(O.some(order[0]));
      } catch (e) {
        console.error(e);
      }
    };
    if (epoch && addresses?.length > 0 && data?.ongoing?.length) {
      fetchData();
    }
  }, [JSON.stringify(addresses)]);

  const voteAll = useCallback(
    async (voteStr: "yay" | "nay" | "abstain", e) => {
      e.preventDefault();
      e.stopPropagation();
      const integration = getIntegration(chains.namada.id);
      const signer = integration.signer() as Signer;

      if (O.isNone(maybeActiveDelegator)) {
        dispatch(
          notificationsActions.createToast({
            id: "no active delegator",
            data: {
              title: "No active delegator",
              message:
                "You dont have any active delegations, you cannot vote. Try refreshing.",
              type: "info",
            },
          })
        );
        throw new Error("No active delegator");
      }

      if (data?.ongoing?.length) {
        if (
          window.confirm(`${data?.ongoing.length} proposals to vote/sign, are you sure ?
This will open ${data?.ongoing.length} times the extension popup`)
        ) {
          data?.ongoing.forEach((pro) => {
            signer.submitVoteProposal(
              {
                signer: maybeActiveDelegator.value,
                vote: voteStr,
                proposalId: BigInt(pro.id),
              },
              {
                token: Tokens.NAM.address || "",
                feeAmount: new BigNumber(0),
                gasLimit: new BigNumber(20_000),
                chainId: chains.namada.chainId,
              },
              AccountType.Mnemonic
            );
          });
        }
      }
    },
    [maybeActiveDelegator]
  );

  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      search(event.target.value, { prefix: true });
    },
    [search]
  );

  const onProposalClick = useCallback((proposalId: string) => {
    dispatch(setActiveProposal(proposalId));
  }, []);

  const specialVotes = data.ongoing?.filter((it) => it.special) || [];

  return (
    <ProposalsContainer>
      <h1>Proposals</h1>
      {<Loading status="Loading" visible={!proposals?.length} />}
      <input
        type="text"
        className="text-namada-black text-sm rounded-lg p-2.5 min-w-[200px] w-1/2 m-4"
        onChange={handleSearchChange}
        placeholder="Search id / abstract / title / author…"
      />
      {!!specialVotes.length && (
        <div className="text-2xl m-4">Protocol votes</div>
      )}
      <ProposalsList>
        {specialVotes.map((proposal, index) => (
          <ProposalCard
            key={index}
            onClick={() => onProposalClick(proposal.id)}
          >
            <ProposalDetails
              proposal={proposal}
              activeDelegator={maybeActiveDelegator}
            />
          </ProposalCard>
        ))}
        {!!specialVotes.length && <hr />}
      </ProposalsList>
      {!specialVotes.length && (
        <div className="relative w-full flex justify-center text-2xl m-4">
          <span>Voting now</span>
          <div className="flex gap-2 absolute right-2">
            <button
              className="w-20 p-1 text-sm bg-white text-green-600 rounded-lg border "
              onClick={(e) => voteAll("yay", e)}
            >
              All Yay
            </button>
            <button
              className="w-20 p-1 text-sm bg-white text-gray rounded-lg border "
              onClick={(e) => voteAll("abstain", e)}
            >
              All Abs.
            </button>
            <button
              className="w-20 p-1 text-sm bg-white text-red-600 rounded-lg border "
              onClick={(e) => voteAll("nay", e)}
            >
              All Nay
            </button>
          </div>
        </div>
      )}
      <ProposalsList>
        {data?.ongoing?.map((proposal, i) => (
          <ProposalCard key={i} onClick={() => onProposalClick(proposal.id)}>
            <ProposalDetails
              proposal={proposal}
              activeDelegator={maybeActiveDelegator}
            />
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
      <hr />
      <div className="text-2xl m-4">Upcoming votes</div>
      <ProposalsList>
        {data?.upcoming?.map((proposal, index) => (
          <ProposalCard
            key={index}
            onClick={() => onProposalClick(proposal.id)}
          >
            <ProposalDetails
              proposal={proposal}
              activeDelegator={maybeActiveDelegator}
            />
          </ProposalCard>
        ))}
      </ProposalsList>
      <hr />
      <div className="text-2xl m-4">Past votes</div>
      <ProposalsList>
        {data?.ended?.map((proposal, index) => (
          <ProposalCard
            key={index}
            onClick={() => onProposalClick(proposal.id)}
          >
            <ProposalDetails
              proposal={proposal}
              activeDelegator={maybeActiveDelegator}
            />
          </ProposalCard>
        ))}
      </ProposalsList>
      {/*<ProposalDetails activeDelegator=activeDelegator*/}
      {/*  open={O.isSome(maybeProposal)}*/}
      {/*  onClose={onDetailsClose}*/}
      {/*  maybeProposal={maybeProposal}*/}
      {/*/>*/}
    </ProposalsContainer>
  );
};
