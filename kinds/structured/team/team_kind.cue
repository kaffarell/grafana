package kind

name: "Team"
maturity: "merged"

lineage: seqs: [
	{
		schemas: [
			// v0.0
			{
				// The ID of an organisation the team belongs to.
				orgId?: int64 @grafanamaturity(MaybeRemove)
				// Name of the team.
				name: string
				// Email of the team.
				email?: string
				// Team avatar URL.
				avatarUrl: string @grafanamaturity(MaybeRemove)
				// Number of the team members.
				memberCount: int64 @grafanamaturity(ToMetadata="kind")
				// TODO - check if it's used in the code
				permission: #Permission @grafanamaturity(ToMetadata="kind")
				// TODO: probably needs a better description
				// Accesscontrol metadata associated with a given resource
				accessControl: [string]: bool @grafanamaturity(ToMetadata="sys")

				#Permission: 1 | 2 | 4 @cuetsy(kind="enum",memberNames="viewer|editor|admin")
			},
		]
	},
]
