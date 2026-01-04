enum Tokens {
	FUNCTION = 'FUNCTION', // Declare Function
	OVERLOAD = 'OVERLOAD', // Operator overloading
	ENUM = 'ENUM', // Declare Enum
	STRUCT = 'STRUCT', // Declare Struct
	RETURN = 'RETURN', // Return from a Function
	CONST = 'CONST', // A constant immutable variable
	LET = 'LET', // A mutable variable
	UNSAFE = 'UNSAFE', // Declare unsafe code section
	DECLARE = 'DECLARE', // Compiler directive

	IF = 'IF', // Control flow if
	ELSE = 'ELSE', // Control flow else
	FOR = 'FOR', // Control flow for loop
	WHILE = 'WHILE', // Control flow while loop
	CONTINUE = 'CONTINUE', // Continue with next iteration in loop
	BREAK = 'BREAK', // Stop current loop

	IMPORT = 'IMPORT', // Import from module
	FROM = 'FROM', // Which module
	EXPORT = 'EXPORT', // Export module
	MODULE = 'MODULE', // Declare module

	IDENTIFIER = 'IDENTIFIER', // Generic Identifier

	OPEN_PAREN = 'OPEN_PAREN', // (
	CLOSE_PAREN = 'CLOSE_PAREN', // )
	OPEN_CURLY = 'OPEN_CURLY', // {
	CLOSE_CURLY = 'CLOSE_CURLY', // }
	OPEN_SQUARE = 'OPEN_SQUARE', // [
	CLOSE_SQUARE = 'CLOSE_SQUARE', // ]
	OPEN_POINTY = 'OPEN_POINTY', // <
	CLOSE_POINTY = 'CLOSE_POINTY', // >
	SEMI = 'SEMI', // ;
	COMMA = 'COMMA', // ,
	DOT = 'DOT', // .
	COLON = 'COLON', // ":" Declare variable or return type
	QUESTION_MARK = 'QUESTION_MARK', // ?
	ASTERISK = 'ASTERISK', // *

	STRING_LITERAL = 'STRING_LITERAL', // Declare String value
	CHARACTER_LITERAL = 'CHARACTER_LITERAL', // Declare single character value
	NUMERIC_LITERAL = 'INTEGER_LITERAL', // Declare integer value
	BOOLEAN_LITERAL = 'BOOLEAN_LITERAL', // Declare boolean value
	NULL_LITERAL = 'NULL_LITERAL', // Null pointer/value
	// POINTER is duplicated and inferred by ASTERISK

	ADD = 'ADD', // +
	SUBTRACT = 'SUBTRACT', // -
	// MULTIPLY is duplicated and inferred by ASTERISK
	POWER = 'POWER', // **
	DIVIDE = 'DIVIDE', // /
	MODULO = 'MODULO', // %

	ASSIGN = 'ASSIGN', // =
	ASSIGN_ADD = 'ASSIGN_ADD', // +=
	ASSIGN_SUBTRACT = 'ASSIGN_SUBTRACT', // -=
	ASSIGN_MULTIPLY = 'ASSIGN_MULTIPLY', // *=
	ASSIGN_DIVIDE = 'ASSIGN_DIVIDE', // /=
	ASSIGN_MODULO = 'ASSIGN_MODULO', // %=
	ASSIGN_SPACESHIP = 'ASSIGN_SPACESHIP', // <>
	ASSIGN_LOGIC_AND = 'ASSIGN_LOGIC_AND', // &=
	ASSIGN_LOGIC_OR = 'ASSIGN_LOGIC_OR', // |=
	ASSIGN_LOGIC_XOR = 'ASSIGN_LOGIC_XOR', // ^=
	ASSIGN_LOGIC_L_SHIFT = 'ASSIGN_LOGIC_L_SHIFT', // <<=
	ASSIGN_LOGIC_R_SHIFT = 'ASSIGN_LOGIC_R_SHIFT', // >>=

	INCREASE = 'INCREASE', // ++
	DECREASE = 'DECREASE', // --

	EQUALS = 'EQUALS', // ==
	EQUALS_OR_GREATER = 'EQUALS_OR_GREATER', // >=
	EQUALS_OR_LESS = 'EQUALS_OR_LESS', // <=
	NOT_EQUALS = 'NOT_EQUALS', // !=
	AND = 'AND', // &&
	OR = 'OR', // ||

	LOGIC_AND = 'LOGIC_AND', // &
	LOGIC_OR = 'LOGIC_OR', // |
	LOGIC_XOR = 'LOGIC_XOR', // ^
	LOGIC_NOT = 'LOGIC_NOT', // !
	LOGIC_L_SHIFT = 'LOGIC_L_SHIFT', // <<
	LOGIC_R_SHIFT = 'LOGIC_R_SHIFT', // >>

	COMMENT = 'COMMENT', // Either // or /* ... */
	EOF = 'EOF', // End of file
}

type Position = {
	line: number;
	column: number;
	index: number;
};

type Token = {
	type: Tokens;
	value: string;
	start: Position;
	end: Position;
};

class Lexer {
	private source: string;
	private position: Position;
	private readonly tokens: Token[];
	private keywords: Map<string, Tokens>;

	constructor(source: string) {
		this.source = source;
		this.position = { line: 1, column: 0, index: 0 };
		this.tokens = [];
		this.keywords = this.initializeKeywords();
	}

	private initializeKeywords(): Map<string, Tokens> {
		const keywords = new Map<string, Tokens>();

		keywords.set('function', Tokens.FUNCTION);
		keywords.set('overload', Tokens.OVERLOAD);
		keywords.set('enum', Tokens.ENUM);
		keywords.set('struct', Tokens.STRUCT);
		keywords.set('return', Tokens.RETURN);
		keywords.set('const', Tokens.CONST);
		keywords.set('let', Tokens.LET);
		keywords.set('unsafe', Tokens.UNSAFE);
		keywords.set('declare', Tokens.DECLARE);

		keywords.set('if', Tokens.IF);
		keywords.set('else', Tokens.ELSE);
		keywords.set('for', Tokens.FOR);
		keywords.set('while', Tokens.WHILE);
		keywords.set('continue', Tokens.CONTINUE);
		keywords.set('break', Tokens.BREAK);

		keywords.set('import', Tokens.IMPORT);
		keywords.set('from', Tokens.FROM);
		keywords.set('export', Tokens.EXPORT);
		keywords.set('module', Tokens.MODULE);

		keywords.set('null', Tokens.NULL_LITERAL);
		keywords.set('true', Tokens.BOOLEAN_LITERAL);
		keywords.set('false', Tokens.BOOLEAN_LITERAL);

		return keywords;
	}

	private peek(amount: number = 1): string {
		if (this.position.index + amount > this.source.length) {
			return this.source.substring(this.position.index);
		}
		return this.source.substring(
			this.position.index,
			this.position.index + amount
		);
	}

	private isAlpha(char: string): boolean {
		const charCode = char.charCodeAt(0);
		return (
			(charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122)
		);
	}

	private isAlphaNumeric(char: string): boolean {
		return this.isAlpha(char) || this.isNumeric(char);
	}

	private isNumeric(char: string): boolean {
		const charCode = char.charCodeAt(0);
		return (
			(charCode >= 48 && charCode <= 57) || ['.', 'e', 'b', 'x'].includes(char)
		);
	}

	private readIdentifier(): Token {
		const startPosition = { ...this.position };
		let identifier = '';

		let next: string = '';
		while ((next = this.peek()) !== '') {
			if (this.isAlphaNumeric(next) || next === '_') {
				identifier += next;
				this.advance();
			} else {
				break;
			}
		}

		return {
			start: startPosition,
			end: { ...this.position },
			type: this.keywords.get(identifier) ?? Tokens.IDENTIFIER,
			value: identifier,
		};
	}

	private readStringLiteral(): Token {
		const startPosition = { ...this.position };
		let stringContent = '';

		let next: string = '';
		this.advance();
		while ((next = this.peek()) !== '') {
			if (next === '\\') {
				this.advance();
				switch (this.peek()) {
					case '"':
						stringContent += '"';
						break;
					case 'n':
						stringContent += String.fromCharCode(10);
						break;
					case 'r':
						stringContent += String.fromCharCode(13);
						break;
					default:
						throw new Error(
							`Unknown escape sequence in string at position: ${this.position}`
						);
				}
				this.advance();
			} else if (next === '"') {
				this.advance();
				break;
			} else {
				stringContent += next;
				this.advance();
			}
		}

		return {
			start: startPosition,
			end: { ...this.position },
			value: stringContent,
			type: Tokens.STRING_LITERAL,
		};
	}

	private isSpecialCharacter(char: string): boolean {
		return [
			'+',
			'-',
			'=',
			'.',
			',',
			'*',
			'/',
			'%',
			'&',
			'|',
			'^',
			':',
			';',
			'?',
			'!',
			"'",
		].includes(char);
	}

	private readSpecialCharacter(): Token {
		const startPosition = { ...this.position };
		const firstChar = this.peek();
		this.advance();
		const followingChar = this.peek();
		let value = firstChar;
		let type: Tokens | null = null;

		switch (firstChar) {
			case '+':
				if (followingChar === '=') {
					this.advance();
					type = Tokens.ASSIGN_ADD;
					value += '=';
				} else if (followingChar === '+') {
					this.advance();
					type = Tokens.INCREASE;
					value += '+';
				} else {
					type = Tokens.ADD;
				}
				break;
			case '-':
				if (followingChar === '=') {
					this.advance();
					type = Tokens.ASSIGN_SUBTRACT;
					value += '=';
				} else if (followingChar === '-') {
					this.advance();
					type = Tokens.DECREASE;
					value += '-';
				} else {
					type = Tokens.SUBTRACT;
				}
				break;
			case '/':
				if (followingChar === '/') {
					this.advance();
					type = Tokens.COMMENT;
					value = '';
					this.skipUntilLineEnd();
				} else if (followingChar === '*') {
					this.advance();
					type = Tokens.COMMENT;
					value = '';
					this.skipUntilSequence('*/');
				} else if (followingChar === '=') {
					this.advance();
					type = Tokens.ASSIGN_DIVIDE;
					value += '=';
				} else {
					type = Tokens.DIVIDE;
				}
				break;
			case '*':
				if (followingChar === '/') {
					throw new Error(
						`Unexpected end of multi line comment at ${this.position}`
					);
				} else if (followingChar === '*') {
					this.advance();
					type = Tokens.POWER;
					value += '*';
				}
				if (followingChar === '=') {
					this.advance();
					type = Tokens.ASSIGN_MULTIPLY;
					value += '=';
				} else {
					type = Tokens.ASTERISK;
				}
				break;
			case '%':
				if (followingChar === '=') {
					this.advance();
					type = Tokens.ASSIGN_MODULO;
					value += '%';
				} else {
					type = Tokens.MODULO;
					value += '%';
				}
				break;
			case '&':
				if (followingChar === '&') {
					this.advance();
					type = Tokens.AND;
					value += '&';
				} else if (followingChar === '=') {
					this.advance();
					type = Tokens.ASSIGN_LOGIC_AND;
					value += '=';
				} else {
					type = Tokens.LOGIC_AND;
				}
				break;
			case '|':
				if (followingChar === '|') {
					this.advance();
					type = Tokens.OR;
					value += '|';
				} else if (followingChar === '=') {
					this.advance();
					type = Tokens.ASSIGN_LOGIC_OR;
					value += '=';
				} else {
					type = Tokens.LOGIC_OR;
				}
				break;
			case '^':
				if (followingChar === '=') {
					this.advance();
					type = Tokens.ASSIGN_LOGIC_XOR;
					value += '=';
				} else {
					type = Tokens.LOGIC_XOR;
				}
				break;
			case '!':
				if (followingChar === '=') {
					this.advance();
					type = Tokens.NOT_EQUALS;
					value += '=';
				} else {
					type = Tokens.LOGIC_NOT;
				}
				break;
			case '=':
				if (followingChar === '=') {
					this.advance();
					type = Tokens.EQUALS;
					value += '=';
				} else {
					type = Tokens.ASSIGN;
				}
				break;
			case "'":
				this.advance();
				type = Tokens.CHARACTER_LITERAL;
				value = followingChar;
				if (this.peek() !== "'") {
					throw new Error(
						'Expected character literal to only contain exactly one character'
					);
				}
				this.advance();
				break;
			case ':':
				type = Tokens.COLON;
				break;
			case ';':
				type = Tokens.SEMI;
				break;
			case ',':
				type = Tokens.COMMA;
				break;
			case '.':
				type = Tokens.DOT;
				break;
			case '?':
				type = Tokens.QUESTION_MARK;
				break;
			default:
				throw new Error(
					`Unexpected character "${firstChar}" at ${this.position}`
				);
		}

		return { start: startPosition, end: { ...this.position }, type, value };
	}

	private skipUntilLineEnd(): void {
		const startPosition = { ...this.position };
		let next = '';
		while ((next = this.peek()) !== '\n') {
			if (next.length === 1) {
				throw new Error(
					`Could not finish skipping until line end because file ended, starting at ${startPosition}"`
				);
			}
			this.advance();
		}
	}

	private skipUntilSequence(seq: string): void {
		const startPosition = { ...this.position };
		let next = '';
		while ((next = this.peek(seq.length)) !== seq) {
			if (next.length !== seq.length) {
				throw new Error(
					`Could not finish skipping until sequence "${seq} because file ended, starting at ${startPosition}"`
				);
			}
			this.movePosition(seq.length);
		}
	}

	private isParen(char: string): boolean {
		return ['(', ')', '[', ']', '{', '}', '<', '>'].includes(char);
	}

	private readParen(): Token {
		const startPosition = { ...this.position };
		let type: Tokens = Tokens.OPEN_PAREN;
		let value = this.peek();
		this.advance();

		switch (value) {
			case '(':
				type = Tokens.OPEN_PAREN;
				break;
			case ')':
				type = Tokens.CLOSE_PAREN;
				break;
			case '[':
				type = Tokens.OPEN_SQUARE;
				break;
			case ']':
				type = Tokens.CLOSE_SQUARE;
				break;
			case '{':
				type = Tokens.OPEN_CURLY;
				break;
			case '}':
				type = Tokens.CLOSE_CURLY;
				break;
			case '<':
				if (this.peek() === '>') {
					this.advance();
					type = Tokens.ASSIGN_SPACESHIP;
					value = '<>';
				} else if (this.peek() === '<') {
					this.advance();
					if (this.peek() === '=') {
						this.advance();
						type = Tokens.ASSIGN_LOGIC_L_SHIFT;
						value += '<=';
					} else {
						type = Tokens.LOGIC_L_SHIFT;
						value += '<';
					}
				} else if (this.peek() === '=') {
					this.advance();
					type = Tokens.EQUALS_OR_LESS;
					value += '=';
				} else {
					type = Tokens.OPEN_POINTY;
				}
				break;
			case '>':
				if (this.peek() === '>') {
					this.advance();
					if (this.peek() === '=') {
						this.advance();
						type = Tokens.ASSIGN_LOGIC_R_SHIFT;
						value += '>=';
					} else {
						this.advance();
						type = Tokens.LOGIC_R_SHIFT;
						value += '>';
					}
				} else if (this.peek() === '=') {
					this.advance();
					type = Tokens.EQUALS_OR_GREATER;
					value += '=';
				} else {
					type = Tokens.CLOSE_POINTY;
				}
				break;
			default:
				throw new Error(
					`Unknown type of parenthesis at position ${this.position}.`
				);
		}
		return { start: startPosition, end: { ...this.position }, type, value };
	}

	private readNumericLiteral(): Token {
		const startPosition = { ...this.position };
		let numericValue = '';

		let hadE = false;
		let next = '';
		while ((next = this.peek()) !== null) {
			if (!this.isNumeric(next) && next != '+' && next != '-') {
				break;
			}
			if (next === 'e') {
				if (hadE) {
					this.advance();
					throw new Error(
						`Numeric literal can only contain exactly one "e" at ${this.position}`
					);
				}
				hadE = true;
			} else if (next === 'b' || next === 'x') {
				if (numericValue !== '0') {
					throw new Error(
						`Unexpected character in numeric literal "${next}" at ${this.position}`
					);
				}
			} else if (next === '+' || next === '-') {
				if (numericValue.charAt(-1) !== 'e') {
					throw new Error(
						`Unexpected character in numeric literal "${next}" at ${this.position}`
					);
				}
			}

			numericValue += next;
			this.advance();
		}

		return {
			start: startPosition,
			end: { ...this.position },
			type: Tokens.NUMERIC_LITERAL,
			value: numericValue,
		};
	}

	private skipWhitespaces(): boolean {
		let skippedWhitespaces = false;

		const whitespaceChars = [' ', '\t', '\n', '\r'];
		let nextChar = this.peek();
		let newLine = this.position.line;
		let newIndex = this.position.index;
		let newColumn = this.position.column;
		while (
			(nextChar = this.peek()) !== null &&
			whitespaceChars.includes(nextChar)
		) {
			skippedWhitespaces = true;
			if (nextChar === '\n') {
				newLine += 1;
				newColumn = 0;
			} else {
				newColumn += 1;
			}
			newIndex += 1;

			this.position = {
				line: newLine,
				column: newColumn,
				index: newIndex,
			};
		}

		return skippedWhitespaces;
	}

	private advance(): void {
		this.movePosition(1);
	}

	private movePosition(amount: number): void {
		this.position.column += amount;
		this.position.index += amount;
	}

	public lex(): Token[] {
		while (this.position.index < this.source.length) {
			this.skipWhitespaces();
			const char = this.peek();

			if (this.isAlpha(char) || char == '_') {
				this.tokens.push(this.readIdentifier());
			} else if (char === '"') {
				this.tokens.push(this.readStringLiteral());
			} else if (this.isParen(char)) {
				this.tokens.push(this.readParen());
			} else if (this.isSpecialCharacter(char)) {
				this.tokens.push(this.readSpecialCharacter());
			} else if (this.isNumeric(char)) {
				this.tokens.push(this.readNumericLiteral());
			} else {
				throw new Error(
					`Unrecognized char: "${char}" at position ${this.position}.`
				);
			}
		}
		this.tokens.push({
			start: { ...this.position },
			end: { ...this.position },
			type: Tokens.EOF,
			value: '',
		});

		return this.tokens;
	}
}

export { Lexer, Tokens };

export type { Token, Position };
