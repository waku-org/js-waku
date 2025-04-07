export class RLNContractError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RLNContractError";
  }
}

export class MembershipError extends RLNContractError {
  public constructor(message: string) {
    super(message);
    this.name = "MembershipError";
  }
}

export class RateLimitError extends RLNContractError {
  public constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class InvalidMembershipError extends MembershipError {
  public constructor(idCommitment: string) {
    super(`Invalid membership ID commitment: ${idCommitment}`);
    this.name = "InvalidMembershipError";
  }
}

export class MembershipNotFoundError extends MembershipError {
  public constructor(idCommitment: string) {
    super(`Membership not found for ID commitment: ${idCommitment}`);
    this.name = "MembershipNotFoundError";
  }
}

export class MembershipExistsError extends MembershipError {
  public constructor(idCommitment: string, index: string) {
    super(
      `Membership already exists for ID commitment: ${idCommitment} at index ${index}`
    );
    this.name = "MembershipExistsError";
  }
}

export class RateLimitExceededError extends RateLimitError {
  public constructor(requested: number, available: number) {
    super(
      `Rate limit exceeded. Requested: ${requested}, Available: ${available}`
    );
    this.name = "RateLimitExceededError";
  }
}

export class InvalidRateLimitError extends RateLimitError {
  public constructor(rateLimit: number, minRate: number, maxRate: number) {
    super(
      `Invalid rate limit: ${rateLimit}. Must be between ${minRate} and ${maxRate}`
    );
    this.name = "InvalidRateLimitError";
  }
}

export class ContractStateError extends RLNContractError {
  public constructor(message: string) {
    super(`Contract state error: ${message}`);
    this.name = "ContractStateError";
  }
}

export class TransactionError extends RLNContractError {
  public constructor(message: string) {
    super(`Transaction failed: ${message}`);
    this.name = "TransactionError";
  }
}
