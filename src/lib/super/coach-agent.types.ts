export type SuperAgentMode = 'coach' | 'question';

export type SuperAgentContext = {
	mode: SuperAgentMode;
	page?: 'coach' | 'practice' | 'progress' | 'history' | 'insights';
	questionId?: string;
	questionType?: 'mcq' | 'frq';
	frqAttemptId?: string;
	quizId?: string;
};

export type SuperToolsInput = {
	userId: string;
	sessionId: string;
	currentContext?: SuperAgentContext;
	conversationId?: string;
};
