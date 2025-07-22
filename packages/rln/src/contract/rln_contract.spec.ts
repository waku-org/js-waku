// import { hexToBytes } from "@waku/utils/bytes";
// import { expect, use } from "chai";
// import chaiAsPromised from "chai-as-promised";
// import * as ethers from "ethers";
// import sinon, { SinonSandbox } from "sinon";

// import { createTestRLNInstance, initializeRLNContract } from "./test_setup.js";
// import {
//   createMockRegistryContract,
//   createRegisterStub,
//   mockRLNRegisteredEvent,
//   verifyRegistration
// } from "./test_utils.js";

// use(chaiAsPromised);

// describe("RLN Contract abstraction - RLN", () => {
//   let sandbox: SinonSandbox;

//   beforeEach(async () => {
//     sandbox = sinon.createSandbox();
//   });

//   afterEach(() => {
//     sandbox.restore();
//   });

//   describe("Member Registration", () => {
//     it("should fetch members from events and store them in the RLN instance", async () => {
//       const { rlnInstance, insertMemberSpy } = await createTestRLNInstance();
//       const membershipRegisteredEvent = mockRLNRegisteredEvent();
//       const queryFilterStub = sinon.stub().returns([membershipRegisteredEvent]);

//       const mockedRegistryContract = createMockRegistryContract({
//         queryFilter: queryFilterStub
//       });

//       const rlnContract = await initializeRLNContract(
//         rlnInstance,
//         mockedRegistryContract
//       );

//       await rlnContract.fetchMembers({
//         fromBlock: 0,
//         fetchRange: 1000,
//         fetchChunks: 2
//       });

//       expect(
//         insertMemberSpy.calledWith(
//           ethers.utils.zeroPad(
//             hexToBytes(membershipRegisteredEvent.args!.idCommitment),
//             32
//           )
//         )
//       ).to.be.true;
//       expect(queryFilterStub.called).to.be.true;
//     });

//     it("should register a member", async () => {
//       const { rlnInstance, identity, insertMemberSpy } =
//         await createTestRLNInstance();

//       const registerStub = createRegisterStub(identity);
//       const mockedRegistryContract = createMockRegistryContract({
//         register: registerStub,
//         queryFilter: () => []
//       });

//       const rlnContract = await initializeRLNContract(
//         rlnInstance,
//         mockedRegistryContract
//       );

//       const decryptedCredentials =
//         await rlnContract.registerWithIdentity(identity);

//       if (!decryptedCredentials) {
//         throw new Error("Failed to retrieve credentials");
//       }

//       verifyRegistration(
//         decryptedCredentials,
//         identity,
//         registerStub,
//         insertMemberSpy
//       );
//     });
//   });
// });
