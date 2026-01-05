# More Information

- [Build Pipeline](#build-pipeline)
- [Handling Generics](#handling-generics)

## Build Pipeline

In this document we document what Steps are taken to compile source code into an executable binary.

```mermaid
sequenceDiagram
participant A as Async Source-File Queue
participant S as Source Code
participant L as Lexer
participant P as Parser
participant C as Checker
participant W as Wait Queue
participant G as LLVM Generator
participant B as Binary

    Note over L, P: Those are Multi-Threaded

    A ->> S: Get Source Code from Queue
    S ->> L: Tokenize Source Code
    L ->> P: Generate ASTNodes
    
    opt Found Import Statement
        P ->> A: Add Source File to Queue
    end

    P ->> C: Perform AI and Domain Binding to validate AST

    opt Insufficient Information
        C ->> W: Save State and add ASTNode to "Waiting"
        W ->> C: Resume generator when Information is there
    end

    C ->> G: Generate LLVM-IR
    G ->> B: Generate Binary
```

## Handling Generics

Generics allow the developer to easily make a method or type hold different types. Generic types are notated by adding `<T>` where T is the name for the generic type.

For generics the compiler will generate a specialized method for all possible (and used) generic types.

Otter will also support "dependent typing", this means a generic type can be inferred by the compiler based on some constraint. For example, this could be used as followed:

```otter
#DynamicGeneric
enum MyEnum<T> {
    OPTION_1<MyStruct1>,
    OPTION_2<MyStruct2>;
}

struct ExampleStruct<T extends MyEnum> {
    ...
    type: T;
    data: *T.generic;
} 
```

In this example, when we create a Struct with the generic type `MyEnum.OPTION_1` the value for `type` would be "OPTION_1" and for `data` the type would be "MyStruct2".