declare module 'bun' {
	type BunBuild = {
		module(path: string, factory: () => { contents: string; loader: 'js' }): void;
	};

	export function plugin(input: { name: string; setup(build: BunBuild): void }): void;
}
