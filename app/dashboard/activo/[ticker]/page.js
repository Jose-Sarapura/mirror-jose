import AssetDetail from '../../components/AssetDetail';

export default async function AssetPage({ params }) {
  const { ticker } = await params;
  return <AssetDetail ticker={String(ticker).toUpperCase()} />;
}
