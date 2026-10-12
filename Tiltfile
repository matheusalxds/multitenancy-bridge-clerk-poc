allow_k8s_contexts('orbstack')

k8s_yaml('k8s/mongo.yaml')
k8s_resource('mongo', port_forwards='27017:27017', labels=['infrastructure'])

local_resource(
    'seed',
    cmd='pnpm --filter api seed',
    resource_deps=['mongo'],
    labels=['data'],
)

local_resource(
    'api',
    serve_cmd='pnpm --filter api start:dev',
    resource_deps=['mongo'],
    labels=['apps'],
    readiness_probe=probe(http_get=http_get_action(port=3000, path='/')),
)

local_resource(
    'web',
    serve_cmd='pnpm --filter web dev',
    resource_deps=['mongo'],
    labels=['apps'],
    readiness_probe=probe(http_get=http_get_action(port=3001, path='/sign-in')),
)
