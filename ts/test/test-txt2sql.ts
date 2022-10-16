import { OutWritter, OutWritterFactory, Txt2Sql, Txt2SqlOptions } from '../src/txt2sql'

import {promises as fs} from 'fs';

import * as YAML from 'yaml';

import * as assert from 'assert/strict'

const EOT = 'END OF TASK';

class ArrayWritter implements OutWritter{
    constructor(public array:(string|typeof EOT)[]){}
    async write(paragraph:string){
        this.array.push(paragraph)
    }
    async close(){
        this.array.push(EOT);
    }
}
class ArrayFactory implements OutWritterFactory{
    public arrays:Record<string, (string|typeof EOT)[]> = {}
    async open(fileName:string){
        this.arrays[fileName] = []
        return new ArrayWritter(this.arrays[fileName]);
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async end(){}
}

class StringFactory extends ArrayFactory{
    public strings: Record<string, string> = {}
    override async end(){
        await super.end()
        for(const name in this.arrays){
            const plain = this.arrays[name].filter(x => x != EOT).join('');
            this.strings[name] = plain
        }
    }
}

var options:Record<string, Txt2SqlOptions> = {
    SIMPLE: {
        field_separator: '|',
        table_name: 'table1',
        insert_columns: true,
        multi_insert: false,
        quote_identifiers: '',
        case: 'lower',
        infer_types: false,
        output_types: false
    }
}

type Fixture = {
    options: Txt2SqlOptions
    do_not_check?: (keyof Fixture["outputs"])[]
    input: string
    outputs: {
        create_table_raw?: string
        inserts: string
        create_table: string
    }
}

describe("txt2sql unit test", function(){
    it("process simple table", async function(){
        const arrayFactory = new ArrayFactory();
        const inputLines = [
            "column1|column 2",
            "data11|data12",
            "data21|O'Donnell",
        ];
        const txt2sql = new Txt2Sql(arrayFactory, options.SIMPLE);
        await txt2sql.processStart();
        for(const line of inputLines){
            // eslint-disable-next-line no-await-in-loop
            await txt2sql.processLine(line)
        }
        await txt2sql.processEnd();
        assert.deepEqual(
            arrayFactory.arrays,
            {
                create_table_raw: [
                    "create table table1 (\n column1 text,\n column_2 text\n);\n",
                    EOT
                ],
                inserts: [
                    "insert into table1 (column1, column_2) values ('data11', 'data12');\n",
                    "insert into table1 (column1, column_2) values ('data21', 'O''Donnell');\n",
                    EOT
                ],
            }
        );
    });
});

describe.only("txt2sql integratin tests", function(){
    const test = (path: string) => 
        path.includes('infer-data-type') && 
        it("test fixture "+path, async function(){
            const fixtureYaml = await fs.readFile(`../fixtures/${path}`, 'utf8');
            const fixture = YAML.parse(fixtureYaml) as Fixture;
            const stringFactory = new StringFactory();
            const txt2sql = new Txt2Sql(stringFactory, fixture.options);
            await txt2sql.processStart();
            for(const line of fixture.input.split(/\r?\n/)){
                // eslint-disable-next-line no-await-in-loop
                await txt2sql.processLine(line);
            }
            if(fixture.do_not_check){
            }
            await txt2sql.processEnd();
            for(var output_name of fixture.do_not_check ?? []){
                // xxxs@ts-expect-error el índice podría ser un número según TS. 
                fixture.outputs[output_name] = stringFactory.strings[output_name]
            }
            // @ts-expect-error
            delete fixture.outputs.inserts_typed
            /*
            if(fixture.infered_info){
                assert.deepEqual(
                    txt2sql.inferedInfo(),
                    fixture.infered_info
                );
            }
            */
            assert.deepEqual(
                stringFactory.strings,
                fixture.outputs
            );
        });
    test('simple-data.yaml');
    test('infer-data-types.yaml');
})