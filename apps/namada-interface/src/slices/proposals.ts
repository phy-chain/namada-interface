import { Query } from "@namada/shared";
import { PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import BigNumber from "bignumber.js";
import { RootState } from "store";
import { match } from "ts-pattern";

export type Proposal = {
  id: string;
  proposalType: "pgf_steward" | "pgf_payment" | "default";
  author: string;
  startEpoch: bigint;
  endEpoch: bigint;
  graceEpoch: bigint;
  content: Partial<{ [key: string]: string }>;
  status: "ongoing" | "finished" | "upcoming";
  result: string;
  totalVotingPower: BigNumber;
  totalYayPower: BigNumber;
  totalNayPower: BigNumber;
  special?: boolean;
  data?: Partial<{ [key: string]: string }>;
};

export type ProposalItem = {
  "Last committed epoch": string;
  id: number;
  "Proposal Id": string;
  Type: string;
  Author: string;
  Content: {
    abstract: string;
    authors: string;
    created: string;
    details: string;
    "discussions-to": string;
    license: string;
    motivation: string;
    requires: string;
    title: string;
  };
  "Start Epoch": string;
  "End Epoch": string;
  "Grace Epoch": string;
  Status: string;
  Data: object;
  special?: boolean;
};

export type ProposalsState = {
  proposals: Proposal[];
  activeProposalId?: string;
};
const PROPOSALS_ACTIONS_BASE = "proposals";
const INITIAL_STATE: ProposalsState = { proposals: [] };

enum ProposalsActions {
  FetchProposals = "fetchProposals",
}

export const fetchProposals = createAsyncThunk<
  Proposal[],
  void,
  { state: RootState }
>(
  `${PROPOSALS_ACTIONS_BASE}/${ProposalsActions.FetchProposals}`,
  async (_, thunkApi) => {
    const { rpc } = thunkApi.getState().chain.config;
    const query = new Query(rpc);
    let proposals: Proposal[] = [];

    try {
      const sdkProposals = await query.queryProposals();

      // const SDKproposals = sdkProposals.map((proposal) => ({
      //   ...proposal,
      //   content: JSON.parse(proposal.contentJSON) as Record<string, string>,
      // }));

      proposals = await fetch(`https://namada.lankou.org/all_proposals.json`)
        .then((res) => res.json())
        .then((data) => {
          const results = Object.values<ProposalItem>(data)
            .filter((it) => parseInt(it["Proposal Id"]) >= 0)
            .map((it) => ({ ...it, id: parseInt(it["Proposal Id"]) }))
            .map((pro) => {
              return {
                id: pro.id.toString(),
                proposalType: match(pro.Type)
                  .when(
                    (x) => x === "PGF funding",
                    () => "pgf_payment" as Proposal["proposalType"]
                  )
                  .when(
                    (x) => x === "PGF steward",
                    () => "pgf_steward" as Proposal["proposalType"]
                  )
                  .otherwise(() => "default" as Proposal["proposalType"]),
                author: pro.Author,
                startEpoch: BigInt(pro["Start Epoch"]),
                endEpoch: BigInt(pro["End Epoch"]),
                graceEpoch: BigInt(pro["Grace Epoch"]),
                content: pro.Content,
                status: match(pro.Status)
                  .when(
                    (x) => x === "ended",
                    () => "ended" as Proposal["status"]
                  )
                  .when(
                    (x) => x === "on-going",
                    () => "on-going" as Proposal["status"]
                  )
                  .otherwise(() => "pending" as Proposal["status"]),
                result: "",
                totalVotingPower: BigNumber(0),
                totalYayPower: BigNumber(0),
                totalNayPower: BigNumber(0),
                special:
                  pro["Content"]["authors"]?.includes("Anoma Foundation"),
                data: pro.Data,
              };
            })
            .sort((a, b) => {
              return a.id > b.id ? -1 : a.id < b.id ? 1 : 0;
            });
          // console.log(proposals[0]);
          // Cache['Last committed epoch'] = parseInt(proposals[0]['Last committed epoch']);
          return results.slice(results.length - 4, results.length - 1);
        });
    } catch (e) {
      console.error(e);
    }

    return proposals;
  }
);

const proposalsSlice = createSlice({
  name: PROPOSALS_ACTIONS_BASE,
  initialState: INITIAL_STATE,
  reducers: {
    setActiveProposal: (state, action: PayloadAction<string | undefined>) => {
      state.activeProposalId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchProposals.fulfilled, (state, action) => {
      state.proposals = action.payload;
    });
  },
});

const { reducer, actions } = proposalsSlice;

export const { setActiveProposal } = actions;

export default reducer;
