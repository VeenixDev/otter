# Otter lang

This is the main source code repository for the Otter lang. Currently, all of this is still very much work in progress and the language is not ready to compile any real programs.

## What is the goal?

The goal of Otter lang is to have a close to the system language, which prioritizes supporting the developer and to not restrict the developer. This should be achieved through a set of non-restrictive check done by the compiler to ensure memory safety is guaranteed and common problems are prevented.

### How do we want to achieve this?

The heart of the approach Otter lang is taking is to heavily utilize Domain Binding and Abstract Interpretation to model the runtime behavior and formally prove the integrity of the program.

## What is the current progress?

Currently, it is possible to compile the example "Hello World" program in "main.otter" and get an executable binary. But many shortcuts are taken to be able to show the end-to-end compilation capabilities.