import { Token, Tokens } from './lexer';
import { randomUUID } from 'node:crypto';

class ASTNode {
	public type: string;
	public children: ASTNode[];
	public data: { [key: string]: unknown };
	public id: string;

	constructor(
		type: string,
		children: ASTNode[],
		data?: { [key: string]: unknown }
	) {
		this.type = type;
		this.children = children;
		this.id = randomUUID();

		this.data = data ?? {};
	}
}

class Parser {
	private tokens: Token[];
	private index;
	private ast: ASTNode[];
	private scopeStack: ASTNode[];

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.index = 0;
		this.scopeStack = [];
		this.ast = [];
	}

	private peek(amount: number = 1): Token | undefined {
		if (this.index + amount > this.tokens.length) {
			return undefined;
		}

		return this.tokens[this.index + amount];
	}

	private advance(amount: number = 1): void {
		if (this.index + amount > this.tokens.length) {
			throw new Error('Could not advance, not enough tokens.');
		}

		this.index++;
	}

	private advanceAndReturnIfTypeMatch(
		type: Tokens,
		throwOnMismatch: boolean = true
	): Token | undefined {
		const nextToken = this.peek();
		if (nextToken && nextToken.type === type) {
			this.advance();
			return nextToken;
		} else if (throwOnMismatch) {
			if (nextToken) {
				throw new Error(
					`Expected ${type} at position ${JSON.stringify(nextToken.start)} but got ${nextToken.type}.`
				);
			} else {
				throw new Error(
					`Expected ${type} after position ${JSON.stringify(this.tokens[this.index].start)} but no token was found.`
				);
			}
		}
	}

	private parseTypeSignature(): ASTNode {
		let genericType: Token | undefined = undefined;
		let hasGeneric = false;
		let isPointer =
			this.advanceAndReturnIfTypeMatch(Tokens.ASTERISK, false) !== undefined;
		let isArray = false;

		const type: Token = this.advanceAndReturnIfTypeMatch(Tokens.IDENTIFIER)!;

		if (
			this.advanceAndReturnIfTypeMatch(Tokens.OPEN_POINTY, false) !== undefined
		) {
			genericType = this.advanceAndReturnIfTypeMatch(Tokens.IDENTIFIER)!;
			void this.advanceAndReturnIfTypeMatch(Tokens.CLOSE_POINTY);
			hasGeneric = true;
		}
		if (
			this.advanceAndReturnIfTypeMatch(Tokens.OPEN_SQUARE, false) !== undefined
		) {
			void this.advanceAndReturnIfTypeMatch(Tokens.CLOSE_SQUARE);
			isArray = true;
		}

		return new ASTNode('TYPE', [], {
			type,
			genericType,
			hasGeneric,
			isPointer,
			isArray,
		});
	}

	private parseFunctionSignature(): ASTNode {
		if (this.scopeStack.length !== 0) {
			throw new Error(`Function can not be declare inside another function.`);
		}
		const startPosition = this.tokens[this.index].start;
		const functionArguments: { [key: string]: unknown } = {};

		const identifier = this.advanceAndReturnIfTypeMatch(Tokens.IDENTIFIER);

		void this.advanceAndReturnIfTypeMatch(Tokens.OPEN_PAREN);
		while (true) {
			let nextToken = this.peek();
			if (!nextToken) {
				throw new Error(
					`Failed to parse function signature at position ${JSON.stringify(startPosition)}, tokens ended unexpectedly.`
				);
			}
			if (nextToken.type === Tokens.COMMA) {
				if (Object.keys(functionArguments).length === 0) {
					throw new Error(
						`Expected IDENTIFIER but got COMMA at position ${JSON.stringify(nextToken.start)}, tokens ended unexpectedly.`
					);
				}
				this.advance();
				continue;
			}
			if (nextToken.type === Tokens.CLOSE_PAREN) {
				break;
			}
			const argumentName = this.advanceAndReturnIfTypeMatch(Tokens.IDENTIFIER)!;
			this.advance();
			functionArguments[argumentName.value] = this.parseTypeSignature();
		}

		void this.advanceAndReturnIfTypeMatch(Tokens.CLOSE_PAREN);
		void this.advanceAndReturnIfTypeMatch(Tokens.COLON);
		const returnType = this.parseTypeSignature();
		void this.advanceAndReturnIfTypeMatch(Tokens.OPEN_CURLY);

		const functionNode = new ASTNode('FUNCTION', [], {
			identifier,
			arguments: functionArguments,
			returnType,
			hasExplicitReturn: false,
		});
		this.scopeStack.push(functionNode);
		this.ast.push(functionNode);
		return functionNode;
	}

	private parseIdentifier(): ASTNode {
		const identifier = this.peek(0)!;
		let peekToken = this.peek();

		if (!peekToken) {
			throw new Error(
				`Unexpected end of Tokens after position ${JSON.stringify(identifier.end)}`
			);
		}

		switch (peekToken.type) {
			case Tokens.OPEN_PAREN:
				this.advance();

				const callArguments: ASTNode[] = [];

				while (true) {
					let nextToken = this.peek();
					if (!nextToken) {
						throw new Error(
							`Failed to parse function call at position ${JSON.stringify(identifier.start)}, tokens ended unexpectedly.`
						);
					}
					if (nextToken.type === Tokens.COMMA) {
						if (Object.keys(callArguments).length === 0) {
							throw new Error(
								`Expected IDENTIFIER but got COMMA at position ${JSON.stringify(nextToken.start)}, tokens ended unexpectedly.`
							);
						}
						this.advance();
						continue;
					}
					if (nextToken.type === Tokens.CLOSE_PAREN) {
						break;
					}
					const argumentToken = this.parseToken(nextToken)!;
					if (!argumentToken) {
						throw new Error(
							`Expected an expression at position ${JSON.stringify(nextToken.start)}.`
						);
					}
					callArguments.push(argumentToken);
					this.advance();
				}

				void this.advanceAndReturnIfTypeMatch(Tokens.CLOSE_PAREN);
				void this.advanceAndReturnIfTypeMatch(Tokens.SEMI);
				return new ASTNode('FUNCTION_CALL', [], {
					arguments: callArguments,
					functionIdentifier: identifier,
				});
			case Tokens.ASSIGN:
				// TODO: Implement parsing of ASSIGN* tokens.
				throw new Error('Not implemented yet!');
			default:
				throw new Error(
					`Unexpected Token ${peekToken.type} at position ${JSON.stringify(peekToken.start)}`
				);
		}
	}

	private addToCurrentScope(node: ASTNode): void {
		if (this.scopeStack.length === 0) {
			throw new Error(
				'Could not add to current scope, because no scope exists.'
			);
		}

		this.scopeStack[this.scopeStack.length - 1].children.push(node);
	}

	private parseStringLiteral(): ASTNode {
		const currentToken = this.peek()!;

		return new ASTNode('STRING_LITERAL', [], {
			value: currentToken.value,
			positions: { start: currentToken.start, end: currentToken.end },
		});
	}

	private parseNumericLiteral(): ASTNode {
		const currentToken = this.peek(0)!;
		const numLitNextToken = this.peek();

		switch (numLitNextToken?.type) {
			case 'ADD':
				let numLitTokenAfterOperator = this.peek(2);
				if (numLitTokenAfterOperator?.type === Tokens.NUMERIC_LITERAL) {
					this.advance(2);
					const additionNode = new ASTNode('BINARY_EXPRESSION', [], {
						operation: 'ADDITION',
					});
					this.ast.push(additionNode);
					return additionNode;
				} else {
					throw new Error(
						`Expected NUMERIC_LITERAL at ${JSON.stringify(numLitNextToken.start)} but got ${numLitTokenAfterOperator?.type}`
					);
				}
			default:
				throw new Error('Unsupported type "' + currentToken.type + '"');
		}
	}

	public parseToken(token: Token): ASTNode | undefined {
		switch (token.type) {
			case Tokens.NUMERIC_LITERAL:
				return this.parseNumericLiteral();
			case Tokens.FUNCTION:
				return this.parseFunctionSignature();
			case Tokens.CLOSE_CURLY:
				const closedScope = this.scopeStack.pop();

				if (closedScope?.type === Tokens.FUNCTION) {
				}
				return undefined;
			case Tokens.STRING_LITERAL:
				return this.parseStringLiteral();
			case Tokens.IDENTIFIER:
				const identifier = this.parseIdentifier();
				this.addToCurrentScope(identifier);
				return identifier;
			case Tokens.EOF:
				if (this.scopeStack.length !== 0) {
					throw new Error('Unexpected end of file.');
				}
				return new ASTNode('EOF', []);
			default:
				throw new Error(
					`Unexpected token type ${token.type} at position ${JSON.stringify(token.start)}`
				);
		}
	}

	public parse(): ASTNode[] {
		while (this.index < this.tokens.length) {
			const node = this.parseToken(this.tokens[this.index]);

			if (node?.type === 'EOF') {
				return this.ast;
			}
			this.advance();
		}
		throw new Error('Unexpected end of file, did not encounter Token EOF');
	}
}

export { Parser, ASTNode };
