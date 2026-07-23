export type Config = {
	LaunchPath: string;
	LaunchArgs: string;
	CloseOnLaunch: boolean;
	ShowStatsPage: boolean;
	UseEac: boolean;
	UpdateChecker: boolean;
};

export type Account = {
	Username: string;
	AccountId: string;
};

export type FullAccount = Account & {
	AuthDeviceId: string;
	AuthSecret: string;
	AccessToken: string | null;
	AccessExpiresAt: number | null;
	RefreshToken: string | null;
	RefreshExpiresAt: number | null;
};
